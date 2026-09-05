/**
 * PSL Academy brand and links.
 *
 * The only place a PSLA colour, mark, name or outbound link is written down.
 * Tailwind reads the colours through the CSS custom properties in
 * src/index.css, which are the HSL form of the hex values below.
 *
 * Do not use #F77B1D or #2D3D4D. Those are drifted values from the old
 * AI Studio site and they are wrong.
 *
 * The names are settled and are not interchangeable:
 *   - the app is PSL Academy
 *   - the organisation is the Professional Services Leadership Academy
 *   - PSLA Community is the free community, not the app
 */

export const BRAND = {
  /** The app. Sidebar, page titles, email sender name, certificates. */
  name: "PSL Academy",
  /** The organisation. Footer, certificate issuer line. */
  organisation: "Professional Services Leadership Academy",
  domain: "learn.professionalservicesleadership.com",

  colours: {
    /** Orange. Buttons, accents. */
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
   * The system stack. The certificate uses Helvetica inside the PDF.
   */
  font: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    certificate: "helvetica",
  },

  links: {
    site: "https://professionalservicesleadership.com",
    terms: "https://professionalservicesleadership.com/terms",
    privacy: "https://professionalservicesleadership.com/privacy-policy",
    contact: "https://professionalservicesleadership.com/contact",
    /**
     * Registration happens here, not in the academy. The form creates the CRM
     * contact and the workflow applies the PSLA Community tag. The academy
     * only ever verifies that a contact already exists.
     */
    registrationForm:
      "https://link.peoplebuilders.com.au/widget/form/MYdYpCKrU2OiKQY2s6ni",
    registrationFormLoader:
      "https://link.peoplebuilders.com.au/js/form_embed.js",
    registrationPage: "https://professionalservicesleadership.com/community",
  },

  support: {
    email: "info@professionalservicesleadership.com",
  },
} as const;

export type Brand = typeof BRAND;
