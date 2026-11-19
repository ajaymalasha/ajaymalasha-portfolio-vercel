import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site, STORY_ENABLED } from "@/content/site";
import "./globals.css";

/* Typefaces are self-hosted under the SIL Open Font License (see src/fonts/licenses). */
const geist = localFont({
  src: "../fonts/Geist-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist",
  display: "swap",
  adjustFontFallback: "Arial",
});

const geistMono = localFont({
  src: "../fonts/GeistMono-Variable.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    url: "/",
    siteName: site.name,
    title: site.title,
    description: site.ogDescription,
    locale: "en_US",
    firstName: "Ajay",
    lastName: "Malasha",
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.ogDescription },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before first paint and decides which first frame stays on screen: the entry screen, or
 * straight into the site or the story (`?v=`, this session's choice, or one made in the last
 * thirty days). The same rule lives in src/lib/experience.ts; keep the two in step.
 */
const bootScript = `(function(){var d=document.documentElement,p=(location.search.match(/[?&]v=(site|story)\\b/)||[])[1];try{var s=sessionStorage.getItem('version'),c=JSON.parse(localStorage.getItem('version-choice')||'null');if(!p)p=s==='site'||s==='story'?s:c&&Date.now()-c.at<2592e6&&(c.id==='site'||c.id==='story')?c.id:''}catch(e){}d.setAttribute('data-entry',${STORY_ENABLED ? "p||'gate'" : "'site'"})})()`;

/**
 * Without scripts nothing would ever arrive: pieces that wait to rise into view are simply
 * shown, and the photograph stands in for the portrait the dots would have drawn.
 */
const noScriptStyles = `[data-reveal]{opacity:1!important;transform:none!important}.split-word{transform:none!important}[data-fx="portrait"]{background:url("/portrait/cutout.webp") center/contain no-repeat}[data-fx="marquee"]{opacity:1!important}`;

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  email: site.email,
  jobTitle: site.role,
  description: site.description,
  worksFor: { "@type": "Organization", name: site.company.name, url: site.company.url },
  address: { "@type": "PostalAddress", addressLocality: site.home.city, addressCountry: "IN" },
  alumniOf: { "@type": "CollegeOrUniversity", name: "Global Institute of Technology, Jaipur" },
  knowsLanguage: ["en", "hi"],
  sameAs: [site.linkedin],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }} />
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: noScriptStyles }} />
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
