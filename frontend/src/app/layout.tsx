import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "../lib/providers";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Salon Beauté — Votre salon de coiffure féminin",
  description:
    "Réservez en ligne chez Salon Beauté. Coupe, coloration, soins capillaires, coiffure mariage. Nos coiffeuses expertes subliment votre beauté.",
  manifest: "/manifest.json",
  themeColor: "#C4A882",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Salon Beauté",
  },
  icons: {
    apple: [
      { url: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-geist-sans)]">
        <Providers>
          <ServiceWorkerRegistration />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
