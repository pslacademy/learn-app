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
 * Draw the certificate.
 *
 * Built at A4 landscape in millimetres, with everything positioned from the
 * centre so the layout holds whatever the length of the name or title.
 * Helvetica, because it is one of the fonts jsPDF has built in: anything else
 * would mean shipping a font file to render a page most members print once.
 */
export const downloadCertificate = (cert: Certificate) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const mid = W / 2;

  const orange: [number, number] = [245, 130];
  const ORANGE: [number, number, number] = [245, 130, 32];
  const NAVY: [number, number, number] = [44, 62, 80];
  const GREY: [number, number, number] = [120, 130, 140];

  // A border rather than a background: a full-bleed colour is a page of ink
  // on somebody's home printer.
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(2.5);
  doc.rect(10, 10, W - 20, H - 20);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.rect(14, 14, W - 28, H - 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...ORANGE);
  doc.text("PROFESSIONAL SERVICES LEADERSHIP ACADEMY", mid, 34, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...GREY);
  doc.text("This is to certify that", mid, 56, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.setTextColor(...NAVY);
  doc.text(cert.member_name, mid, 74, { align: "center" });

  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.8);
  doc.line(mid - 55, 80, mid + 55, 80);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(...GREY);
  doc.text("has successfully completed", mid, 94, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(...NAVY);
  // Wrapped, so a long course title does not run off the page.
  const title = doc.splitTextToSize(cert.course_title, W - 80) as string[];
  doc.text(title, mid, 110, { align: "center" });

  const issued = new Date(cert.issued_at).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...GREY);
  doc.text(`Issued ${issued}`, mid, 134 + (title.length - 1) * 10, {
    align: "center",
  });

  // The credential id, small and at the foot: it is for checking, not for
  // looking at.
  doc.setFontSize(9);
  doc.text(`Credential ID: ${cert.code}`, mid, H - 26, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("Grant Herbert", mid, H - 40, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(BRAND.organisation, mid, H - 34, { align: "center" });

  const safe = cert.course_title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`psla-certificate-${safe}-${cert.code}.pdf`);
};
