import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Copyright Notice — AlgaeAI",
  description:
    "Copyright and intellectual property information for AlgaeAI.",
};

export default function CopyrightPage() {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <Header />
      <main className="main-content legal-page">
        <h1>Copyright Notice</h1>
        <p className="legal-effective">Effective Date: April 26, 2026</p>

        <section className="legal-section">
          <h2>1. Ownership</h2>
          <p>
            &copy; {currentYear} AlgaeAI. All rights reserved. The AlgaeAI
            name, logo, website design, AI models, and all associated content
            are the intellectual property of AlgaeAI and its contributors.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Platform Content</h2>
          <p>
            All text, graphics, user interfaces, visual interfaces, photographs,
            trademarks, logos, algorithms, and computer code contained on the
            AlgaeAI platform are owned, controlled, or licensed by AlgaeAI and
            are protected by copyright, trademark, and other intellectual
            property laws.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. AI-Generated Results</h2>
          <p>
            Species identification results produced by our AI models are
            generated for informational and educational purposes. While we
            strive for accuracy, these results are AI-generated outputs and
            should be independently verified for any critical applications.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. User-Submitted Content</h2>
          <p>
            Users retain copyright ownership of images they upload to the
            Service. By submitting images through the Contribute feature, users
            grant AlgaeAI a non-exclusive, royalty-free license to use, display,
            and process the content as described in our{" "}
            <a href="/terms">Terms of Service</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Scientific Data &amp; References</h2>
          <p>
            Ecological data, taxonomic classifications, and species information
            displayed in identification results may be sourced from public
            scientific databases including GBIF (Global Biodiversity Information
            Facility) and peer-reviewed literature. Proper attribution is
            maintained where applicable.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Fair Use</h2>
          <p>
            Limited use of AlgaeAI content for educational, research, or
            non-commercial purposes may be permitted under fair use doctrine.
            Commercial use, reproduction, or redistribution of any content from
            this platform requires prior written permission.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. DMCA &amp; Takedown Requests</h2>
          <p>
            If you believe that content on AlgaeAI infringes your copyright,
            please contact us with a detailed description of the alleged
            infringement at{" "}
            <a href="mailto:copyright@algaeai.app">copyright@algaeai.app</a>.
            We will respond to valid takedown requests in accordance with
            applicable law.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Open-Source Acknowledgments</h2>
          <p>
            AlgaeAI is built with open-source technologies including Next.js,
            React, and Supabase. We acknowledge and respect the licenses of all
            third-party libraries and frameworks used in this project.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Contact</h2>
          <p>
            For copyright-related inquiries, please contact us at{" "}
            <a href="mailto:copyright@algaeai.app">copyright@algaeai.app</a>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
