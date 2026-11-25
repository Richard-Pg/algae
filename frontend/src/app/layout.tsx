import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "AlgaeAI — identify algae and diatoms",
    template: "%s · AlgaeAI",
  },
  description:
    "Identify algae and diatoms from microscope or bloom photos, check toxin risk and ecology, and contribute reviewed observations to an open algae database.",
  keywords: ["algae", "diatom", "identification", "cyanobacteria", "harmful algal bloom", "microscopy", "phytoplankton"],
};

export const viewport: Viewport = {
  themeColor: "#0e1714",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only z-50 rounded bg-signal px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
          >
            Skip to content
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
