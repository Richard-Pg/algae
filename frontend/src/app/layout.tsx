import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "AlgaeAI - AI Algae & Diatom Identification",
  description: "AI-powered identification of algae and diatoms from microscope and bloom photos. Get instant species predictions, confidence scores, toxin risk assessment, and ecological information.",
  keywords: ["algae", "diatom", "identification", "AI", "cyanobacteria", "microscopy", "phytoplankton", "water quality"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <div className="app-container">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
