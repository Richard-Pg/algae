import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how AlgaeAI collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <>
      <article className="legal-page">
        <h1>Privacy Policy</h1>
        <p className="legal-effective">Effective Date: April 26, 2026</p>

        <section className="legal-section">
          <h2>1. Information We Collect</h2>
          <h3>1.1 Account Information</h3>
          <p>
            When you create an account, we collect your email address and
            authentication credentials. We use Supabase for secure
            authentication.
          </p>
          <h3>1.2 Uploaded Images</h3>
          <p>
            Images you upload for identification are processed by our AI model
            and stored in private cloud storage together with the result, so
            the result page can be reopened. Stored images are only shown
            through short-lived links: to you, to anyone you share a result
            with, and to reviewers. Results from guests are viewable by anyone
            who has the result link. Signed-in users can delete their results
            at any time from their workspace.
          </p>
          <h3>1.3 Usage Data</h3>
          <p>
            To enforce daily identification limits, our server counts recent
            requests per account, or per IP address for guests. These counts are
            kept in memory and are not stored permanently.
          </p>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>To provide and maintain the identification Service.</li>
            <li>To store your identification history (registered users).</li>
            <li>
              To publish observations you submit to the open species database,
              after a reviewer approves them. Approved images, your display
              name and the location you provided become publicly visible.
            </li>
            <li>To improve our AI model accuracy and Service quality.</li>
            <li>To communicate important Service updates.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>3. Data Sharing</h2>
          <p>
            We do not sell, trade, or rent your personal information to third
            parties. We may share anonymized, aggregated data for research
            purposes. Uploaded images may be processed by third-party AI
            services (such as Google Gemini) solely for the purpose of species
            identification.
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Data Storage &amp; Security</h2>
          <p>
            Your data is stored using industry-standard security practices via
            Supabase infrastructure. We implement appropriate technical and
            organizational measures to protect your personal information against
            unauthorized access, alteration, or destruction.
          </p>
        </section>

        <section className="legal-section">
          <h2>5. Data Retention</h2>
          <p>
            Account data and identification history are retained as long as your
            account is active. You may request deletion of your account and
            associated data at any time by contacting us.
          </p>
        </section>

        <section className="legal-section">
          <h2>6. Cookies &amp; Local Storage</h2>
          <p>
            We store your sign-in session in browser storage. We do not use
            third-party tracking cookies.
          </p>
        </section>

        <section className="legal-section">
          <h2>7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Withdraw consent for data processing.</li>
            <li>Export your identification history.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>8. Children&apos;s Privacy</h2>
          <p>
            The Service is not directed to children under 13. We do not
            knowingly collect personal information from children under 13 years
            of age.
          </p>
        </section>

        <section className="legal-section">
          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. We will notify
            registered users of material changes via email or in-app notice.
          </p>
        </section>

        <section className="legal-section">
          <h2>10. Contact</h2>
          <p>
            For privacy-related inquiries, please contact us at{" "}
            <a href="mailto:privacy@algaeai.app">privacy@algaeai.app</a>.
          </p>
        </section>
      </article>
    </>
  );
}
