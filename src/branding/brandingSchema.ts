/**
 * The organisation's branding (Administration → Image de marque): app name, tagline, logo, favicon and colours.
 * Read by everyone (even on the sign-in page), written by administrators with admin.branding. The server validates
 * every save against this schema (strict: unknown fields refused).
 */
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
/** Raster images only (an SVG could carry scripts); the browser converts SVG logos to PNG before saving. */
const image = z
  .string()
  .max(700_000)
  .regex(/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/);

export const BrandColorsSchema = z.strictObject({
  /** Main brand colour: buttons, links, the dashboard accent. */
  primary: hex.nullable(),
  /** Sidebar background and text. */
  sidebarBg: hex.nullable(),
  sidebarText: hex.nullable(),
  /** Page background in the light and dark themes. */
  bgLight: hex.nullable(),
  bgDark: hex.nullable(),
});

export const BrandingSchema = z.strictObject({
  /** Big name in the sidebar and on the sign-in page (e.g. PUBCO). */
  appName: z.string().trim().min(1).max(40),
  /** Small line under it (e.g. Imago · Hub 2.0). */
  tagline: z.string().trim().max(60),
  /** Browser tab title. */
  title: z.string().trim().min(1).max(80),
  /** Logo shown instead of the butterfly; null = the butterfly. */
  logo: image.nullable(),
  /** Browser tab icon; null = the default. */
  favicon: image.nullable(),
  colors: BrandColorsSchema,
});

export type Branding = z.infer<typeof BrandingSchema>;
export type BrandColors = z.infer<typeof BrandColorsSchema>;

export const DEFAULT_BRANDING: Branding = {
  appName: 'PUBCO',
  tagline: 'Imago · Hub 2.0',
  title: 'Imago · Pubco Hub',
  logo: null,
  favicon: null,
  colors: { primary: null, sidebarBg: null, sidebarText: null, bgLight: null, bgDark: null },
};

/** What the website reader found (Administration → Image de marque → Importer depuis un site web). */
export interface SiteBranding {
  url: string;
  name: string | null;
  description: string | null;
  themeColor: string | null;
  /** Candidate logos and icons, as data URLs fetched by the server (SVG included: shown in <img> only, never stored). */
  images: { src: string; kind: 'logo' | 'icon' | 'social'; label: string }[];
  /** Main colours of the site, most used first (greys left out). */
  colors: string[];
  fonts: string[];
}
