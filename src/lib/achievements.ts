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
 * Draw the certificate.
 *
 * Laid out like EI Academy's: an accent bar down the left edge, the logo top
 * left, the credential id top right, then the citation ranged left. Ranged
 * left rather than centred because a centred certificate reads as a template
 * and this one has to stand up in front of a firm.
 *
 * A4 landscape in millimetres. Helvetica, one of the fonts jsPDF has built
 * in: anything else means shipping a font file to render a page most members
 * print once.
 */
export const downloadCertificate = async (cert: Certificate) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const ORANGE: [number, number, number] = [245, 130, 32];
  const NAVY: [number, number, number] = [44, 62, 80];
  const GREY: [number, number, number] = [110, 120, 130];

  const left = 34;

  // The accent bar down the left edge.
  doc.setFillColor(...ORANGE);
  doc.rect(0, 0, 6, H, "F");
  doc.setFillColor(...NAVY);
  doc.rect(6, 0, 1.6, H, "F");

  /*
    The logo.

    A PNG of the full logo if there is one, and the name typeset if not. The
    SVG logo cannot be used: jsPDF places PNG and JPEG only.
  */
  const logo = await asDataUrl(BRAND.certificate.logoUrl);
  if (logo) {
    try {
      /* Placed to a fixed height with the width left to the natural ratio, so
         a logo of any proportion sits correctly rather than being squashed
         into a box that was guessed at. */
      const props = doc.getImageProperties(logo);
      const h = 16;
      const w = (props.width / props.height) * h;
      doc.addImage(logo, "PNG", left, 20, w, h);
    } catch (_) {
      /* an unusable image is not worth failing the page for */
    }
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text("PROFESSIONAL SERVICES", left, 28);
    doc.setTextColor(...ORANGE);
    doc.text("LEADERSHIP ACADEMY", left, 34);
  }

  // Credential id, top right.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...GREY);
  spacedCaps(doc, "CREDENTIAL ID", W - 34 - doc.getTextWidth("CREDENTIAL ID") - 18, 27, 1.2);
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
  const title = doc.splitTextToSize(cert.course_title, W - left - 90) as string[];
  doc.text(title, left, 128);

  /*
    The signature block.

    The rule is the fixed point and everything is measured from it, so the
    signature rests on the line rather than floating above it. Sized by its
    own ratio for the same reason as the logo: a signature squashed into a
    guessed box looks forged.
  */
  const RULE_Y = H - 48;

  const sig = await asDataUrl(BRAND.certificate.signatureUrl);
  if (sig) {
    try {
      const props = doc.getImageProperties(sig);
      const h = 18;
      const w = (props.width / props.height) * h;
      // Sat on the line, with a hair of overlap so the pen appears to touch it.
      doc.addImage(sig, "PNG", left, RULE_Y - h + 1.5, Math.min(w, 80), h);
    } catch (_) {
      /* the rule and the name below still make sense on their own */
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

  /* The seal, level with the signature block rather than floating on its own,
     which is where a seal is pressed on a real document. */
  const seal = await asDataUrl(BRAND.certificate.sealUrl);
  if (seal) {
    try {
      const props = doc.getImageProperties(seal);
      const h = 42;
      const w = (props.width / props.height) * h;
      doc.addImage(seal, "PNG", W - 52 - w / 2, RULE_Y - h + 12, w, h);
    } catch (_) {
      /* a certificate without a seal still reads correctly */
    }
  }

  const safe = cert.course_title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`psla-certificate-${safe}-${cert.code}.pdf`);
};
