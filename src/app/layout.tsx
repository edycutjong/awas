import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted OFL faces (public/fonts), so every surface renders the same glyphs with no
// third-party font request: Abril Fatface for the masthead, Atkinson Hyperlegible Next for
// every sentence a family reads, Atkinson Hyperlegible Mono for numbers, URLs and receipts.
const abril = localFont({
  src: "../../public/fonts/abril-fatface-400.woff2",
  weight: "400",
  variable: "--font-abril",
  display: "swap",
  // "Bodoni 72" must stay quoted (a digit token): it lives in the CSS stack, not here.
  fallback: ["Didot", "Georgia", "serif"],
});

const atkinson = localFont({
  src: "../../public/fonts/atkinson-hyperlegible-next-wght.woff2",
  weight: "200 800",
  variable: "--font-atkinson",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const atkinsonMono = localFont({
  src: "../../public/fonts/atkinson-hyperlegible-mono-wght.woff2",
  weight: "200 800",
  variable: "--font-atkinson-mono",
  display: "swap",
  fallback: ["ui-monospace", "Menlo", "monospace"],
});

const DESCRIPTION =
  "Paste a job ad. Awas builds an evidence file: every line is a URL plus a quote code found verbatim on that page. Then it says STOP or VERIFY FIRST.";

const TITLE = "Awas — check a job ad before anyone boards";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://awas.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Awas",
  authors: [{ name: "Edy Cu" }],
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Awas",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Awas: every line is a URL and a verified quote" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBFAF5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${abril.variable} ${atkinson.variable} ${atkinsonMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
