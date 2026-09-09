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
      "https://academy.professionalservicesleadership.com/widget/form/MYdYpCKrU2OiKQY2s6ni",
    registrationPage: "https://professionalservicesleadership.com/community",

    /**
     * The support request form, embedded on the Support page.
     *
     * Same GoHighLevel account and the same white-label domain as the
     * registration form, so a member sees one domain wherever they are asked
     * for something.
     */
    supportForm:
      "https://academy.professionalservicesleadership.com/widget/form/b9sh5zQ93uUnda8SZ7QS",

    /**
     * GoHighLevel's embed script, shared by both forms. One entry rather than
     * one per form: they are served from the same host, and two copies would
     * eventually disagree about which host that is.
     */
    formLoader:
      "https://academy.professionalservicesleadership.com/js/form_embed.js",
  },

  /**
   * The certificate.
   *
   * The signature is a PNG with a transparent background, uploaded to GHL
   * Media Storage. Held here rather than in the drawing code so it can be
   * replaced without touching the layout.
   *
   * An empty signature is not an error: the certificate draws the ruled line
   * and the name without it, which is a certificate missing a signature
   * rather than a broken page.
   */
  certificate: {
    signatureUrl:
      "https://assets.cdn.filesafe.space/JPAvk9j6fev90MrYL2Nb/media/6aa0dc0edd867dc12de8a2e8.png",
    signatoryName: "Grant Herbert",
    signatoryTitle: "Professional Services Leadership Mentor",
    /**
     * The seal, as an image.
     *
     * A drawn one was tried first and looked drawn. This is a real seal.
     *
     * PNG with a transparent background: jsPDF places PNG and JPEG only, so
     * the SVG logo cannot be used here and a PNG version is needed alongside
     * it.
     */
    sealUrl:
      "https://assets.cdn.filesafe.space/JPAvk9j6fev90MrYL2Nb/media/6aa0e25dd63e08439cd82b65.png",

    /**
     * The full logo, as a PNG for the same reason.
     *
     * Empty until one exists, in which case the certificate sets the academy
     * name in type instead. A certificate with the name typeset is fine; one
     * that fails to generate is not.
     */
    logoUrl:
      "https://assets.cdn.filesafe.space/JPAvk9j6fev90MrYL2Nb/media/69f44fd8e9694b9664d25c6c.png",
  },

  support: {
    email: "info@professionalservicesleadership.com",
  },
} as const;

export type Brand = typeof BRAND;
