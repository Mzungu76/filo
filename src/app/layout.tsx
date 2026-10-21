import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Filo — organizza il tuo studio",
  description: "Compiti, timer e pause. Un passo alla volta.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Filo" },
  icons: { icon: "/icon.svg", apple: "/icon-180.png" }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f6f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1721" }
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <head>
        {/* Tema scelto: applicato prima del primo disegno, niente lampo bianco. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('filo-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}" }}/>
        <link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossOrigin=""/>
        <link rel="preload" href="/fonts/dm-sans-latin.woff2" as="font" type="font/woff2" crossOrigin=""/>
      </head>
      <body>{children}</body>
    </html>
  );
}
