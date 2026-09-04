/**
 * PSLA Academy brand.
 *
 * This is the only place a PSLA colour, mark or font is written down.
 * Nothing else in the app hardcodes one. Tailwind reads these values through
 * the CSS custom properties in src/index.css, which are generated from the
 * hex values below.
 *
 * Do not use #F77B1D or #2D3D4D. Those are drifted values from the old
 * AI Studio site and they are wrong.
 */

export const BRAND = {
  name: "PSLA Academy",
  organisation: "Professional Services Leadership Academy",
  domain: "learn.professionalservicesleadership.com",

  colours: {
    /** Orange. Buttons, headings, accents. */
    primary: "#F58220",
    /** Navy. Headings, dark surfaces. */
    secondary: "#2C3E50",
    /** Bands, cards. */
    muted: "#F3F5F7",
    /** Rules, card edges. */
    border: "#DAE0E7",
    ink: "#1A1A1A",
    surface: "#FFFFFF",
  },

  marks: {
    logo: "https://assets.cdn.filesafe.space/JPAvk9j6fev90MrYL2Nb/media/6a290d3ec76f43a028e75f6f.svg",
    favicon:
      "https://assets.cdn.filesafe.space/JPAvk9j6fev90MrYL2Nb/media/69efd9ecd65f43b68cfa9315.png",
  },

  /**
   * Same as EI Academy, confirmed by Grant on 4 September 2026: no webfont.
   * The system stack, which is what EIA renders through Tailwind's default.
   * The certificate uses Helvetica inside the PDF, drawn with jsPDF.
   */
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    certificate: "helvetica",
  },
} as const;

export type Brand = typeof BRAND;
