import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — AlgaeAI",
  description:
    "Read the Terms of Service for AlgaeAI, the AI-powered algae and diatom identification platform.",
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="main-content legal-page">
        <h1>Terms of Service</h1>
        <p className="legal-effective">Effective Date: April 26, 2026</p>

        <section className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the AlgaeAI platform (&ldquo;Service&rdquo;),
            you agree to be bound by these Terms of Service. If you do not agree
            to these terms, please discontinue use of the Service immediately.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. Description of Service</h2>
          <p>
            AlgaeAI provides AI-powered identification of algae and diatom
            species from user-uploaded microscope or bloom photographs. The
            Service delivers species predictions, confidence scores, toxin risk
            assessments, and ecological information for educational and research
            purposes.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. User Accounts</h2>
          <p>
            You may use the Service as a guest with limited functionality or
            create an account for full access. You are responsible for
            maintaining the confidentiality of your account credentials and for
            all activities that occur under your account.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose.</li>
            <li>
              Upload content that infringes on third-party intellectual property
              rights.
            </li>
            <li>
              Attempt to reverse-engineer, decompile, or interfere with the
              Service&apos;s infrastructure.
            </li>
            <li>
              Use automated scripts or bots to access the Service without
              express written permission.
            </li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Disclaimer of Warranties</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as
            available&rdquo; without warranties of any kind, either express or
            implied. AI-generated identifications are probabilistic and should
            not be used as the sole basis for public health decisions, water
            management actions, or clinical diagnoses.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, AlgaeAI and its
            contributors shall not be liable for any indirect, incidental,
            special, consequential, or punitive damages arising from your use of
            the Service.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. User-Generated Content</h2>
          <p>
            By uploading images or submitting species data through the Contribute
            feature, you grant AlgaeAI a non-exclusive, royalty-free,
            worldwide license to use, display, and process the submitted content
            for the purpose of improving and operating the Service.
          </p>
        </section>

        <section className="legal-section">
          <h2>8. Modifications to Terms</h2>
          <p>
            We reserve the right to modify these terms at any time. Continued
            use of the Service after changes are posted constitutes acceptance of
            the revised terms.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Contact</h2>
          <p>
            If you have any questions about these Terms, please contact us at{" "}
            <a href="mailto:support@algaeai.app">support@algaeai.app</a>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
