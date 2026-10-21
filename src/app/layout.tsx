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
  themeColor: "#172a3a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
