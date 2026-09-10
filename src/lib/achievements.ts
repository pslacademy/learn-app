// src/lib/achievements.ts
//
// What a member has finished, and what they have to show for it.
//
// A certificate is earned when every module of a course is complete, and a
// module is complete when all its published lessons are. The database decides
// that and issues the row; this file asks, reports, and draws the PDF.

import jsPDF from "jspdf";
import { supabase } from "./supabase";
import { BRAND } from "@/config/brand";
import type { Course } from "./courses";
import { isLessonComplete } from "./progress";

export interface Certificate {
  id: string;
  member_id: string;
  course_id: string;
  code: string;
  course_title: string;
  member_name: string;
  issued_at: string;
}

export interface ModuleRequirement {
  id: string;
  title: string;
  done: number;
  total: number;
  complete: boolean;
}

/**
 * A course's modules as certification requirements.
 *
 * Counted in modules rather than lessons, because that is what earns the
 * certificate. A member three lessons into a five-lesson module has done
 * nothing towards it yet, and saying so is more honest than a percentage
 * that creeps up and then stalls.
 */
export const requirementsFor = (course: Course): ModuleRequirement[] =>
  course.modules.map((m) => {
    const lessons = m.lessons.filter((l) => l.is_published);
    const done = lessons.filter((l) => isLessonComplete(l.id)).length;
    return {
      id: m.id,
      title: m.title,
      done,
      total: lessons.length,
      /* An empty module is never complete: otherwise a course still being
         written would certify everybody who opened it. */
      complete: lessons.length > 0 && done === lessons.length,
    };
  });

export const moduleProgress = (course: Course): number => {
  const reqs = requirementsFor(course);
  if (reqs.length === 0) return 0;
  return Math.round(
    (reqs.filter((r) => r.complete).length / reqs.length) * 100,
  );
};

export const getCertificates = async (): Promise<Certificate[]> => {
  const { data, error } = await supabase
    .from("certificates")
    .select("*")
    .order("issued_at", { ascending: false });

  if (error) {
    console.error("Could not read your certificates:", error.message);
    return [];
  }
  return (data ?? []) as Certificate[];
};

/**
 * Claim the certificate for a finished course.
 *
 * Safe to call whenever a course looks complete: the database refuses if it
 * is not, and returns the existing certificate rather than a second one if it
 * has already been issued.
 */
export const claimCertificate = async (
  courseId: string,
): Promise<Certificate | null> => {
  const { data, error } = await supabase.rpc("issue_certificate", {
    p_course: courseId,
  });

  if (error) {
    /* Not an error worth showing. The usual reason is that the course is not
       finished, which the member can see for themselves on the page. */
    console.info("No certificate issued:", error.message);
    return null;
  }
  return data as Certificate;
};

/**
 * Fetch an image and turn it into a data URL.
 *
 * jsPDF cannot take a URL: it needs the bytes. Returns null rather than
 * throwing, because a certificate missing its logo is far better than a
 * certificate that would not generate at all.
 */
const asDataUrl = async (url: string): Promise<string | null> => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
};

/** Letterspaced capitals, the way the heading is set. */
const spacedCaps = (
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  gap = 1.6,
) => {
  let cursor = x;
  for (const ch of text) {
    doc.text(ch, cursor, y);
    cursor += doc.getTextWidth(ch) + gap;
  }
};

/**
 * Print the four variable fields onto a template.
 *
 * Positions come from brand.ts as percentages of the page, so they can be
 * judged against the design and moved without touching this code.
 */
const printFields = (
  doc: jsPDF,
  cert: Certificate,
  W: number,
  H: number,
) => {
  const { fields, textColour, accentColour } = BRAND.certificate;

  const put = (
    text: string,
    f: {
      x: number;
      y: number;
      size: number;
      align: "left" | "center" | "right";
      bold: boolean;
      maxWidth: number;
    },
    colour: [number, number, number],
  ) => {
    doc.setFont("helvetica", f.bold ? "bold" : "normal");
    doc.setFontSize(f.size);
    doc.setTextColor(...colour);

    // Wrapped, so a long name or course title stays on the page rather than
    // running off the edge of somebody's certificate.
    const lines = doc.splitTextToSize(text, (W * f.maxWidth) / 100) as string[];
    doc.text(lines, (W * f.x) / 100, (H * f.y) / 100, { align: f.align });
  };

  const issued = new Date(cert.issued_at).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  put(cert.member_name, fields.memberName, textColour);
  put(cert.course_title, fields.courseTitle, accentColour);
  put(issued, fields.issuedDate, textColour);
  put(cert.code, fields.credentialId, textColour);
};

/**
 * Draw the certificate from its parts.
 *
 * The fallback, used when there is no template or it cannot be reached. It is
 * deliberately plain: its job is to be a usable document, not to compete with
 * a design.
 */
const drawFallback = async (doc: jsPDF, cert: Certificate, W: number, H: number) => {
  const ORANGE: [number, number, number] = [245, 130, 32];
  const NAVY: [number, number, number] = [44, 62, 80];
  const GREY: [number, number, number] = [110, 120, 130];
  const left = 34;

  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 6, H, "F");
  doc.setFillColor(...NAVY);
  doc.rect(6, 0, 1.6, H, "F");

  const logo = await asDataUrl(BRAND.certificate.logoUrl);
  if (logo) {
    try {
      const props = doc.getImageProperties(logo);
      const ratio = props.width / props.height;
      const h = Math.min(20, 90 / ratio);
      doc.addImage(logo, "PNG", left, 22, h * ratio, h);
    } catch (_) {
      /* the name below still identifies it */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...GREY);
  spacedCaps(doc, "CREDENTIAL ID", W - 34 - 42, 27, 1.2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(cert.code, W - 34, 34, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...ORANGE);
  spacedCaps(doc, "CERTIFICATE OF COMPLETION", left, 62, 1.9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GREY);
  doc.text("This is to certify that", left, 78);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(38);
  doc.setTextColor(30, 35, 40);
  doc.text(cert.member_name, left, 98);

  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(1);
  doc.line(left, 105, left + Math.max(90, doc.getTextWidth(cert.member_name)), 105);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GREY);
  doc.text("has successfully completed", left, 118);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...ORANGE);
  const title = doc.splitTextToSize(cert.course_title, W - left - 100) as string[];
  doc.text(title, left, 128);

  const RULE_Y = H - 48;

  const sig = await asDataUrl(BRAND.certificate.signatureUrl);
  if (sig) {
    try {
      const props = doc.getImageProperties(sig);
      const h = 18;
      const w = (props.width / props.height) * h;
      doc.addImage(sig, "PNG", left, RULE_Y - h + 1.5, Math.min(w, 80), h);
    } catch (_) {
      /* the rule and name still read correctly */
    }
  }

  doc.setDrawColor(190, 196, 202);
  doc.setLineWidth(0.4);
  doc.line(left, RULE_Y, left + 78, RULE_Y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 35, 40);
  doc.text(BRAND.certificate.signatoryName, left, RULE_Y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(BRAND.certificate.signatoryTitle, left, RULE_Y + 13);
  doc.text(
    new Date(cert.issued_at).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    left,
    RULE_Y + 22,
  );

  const seal = await asDataUrl(BRAND.certificate.sealUrl);
  if (seal) {
    try {
      const props = doc.getImageProperties(seal);
      const h = 42;
      const w = (props.width / props.height) * h;
      doc.addImage(seal, "PNG", W - 52 - w / 2, RULE_Y - h + 12, w, h);
    } catch (_) {
      /* it reads correctly without one */
    }
  }
};

/**
 * The certificate.
 *
 * A4 landscape in millimetres. With a template, this places the image and
 * prints four fields on it; without one, it draws the fallback.
 */
export const downloadCertificate = async (cert: Certificate) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const template = await asDataUrl(BRAND.certificate.templateUrl);

  if (template) {
    try {
      /*
        Placed to fill the page exactly. A template made at the stated size is
        already A4 landscape, so nothing is stretched; one made at another
        ratio is fitted to the page rather than cropped, because a cropped
        certificate loses its border.
      */
      const kind = template.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(template, kind, 0, 0, W, H);
      printFields(doc, cert, W, H);
    } catch (_) {
      await drawFallback(doc, cert, W, H);
    }
  } else {
    await drawFallback(doc, cert, W, H);
  }

  const safe = cert.course_title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`psla-certificate-${safe}-${cert.code}.pdf`);
};
