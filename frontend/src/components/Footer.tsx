import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer" id="site-footer">
      <div className="footer-inner">
        {/* Brand */}
        <div className="footer-brand">
          <Link href="/" className="footer-logo">
            <span className="logo-icon">🧬</span>
            AlgaeAI
          </Link>
          <p className="footer-tagline">
            AI-powered algae &amp; diatom identification for researchers,
            educators, and environmental scientists.
          </p>
        </div>

        {/* Links */}
        <nav className="footer-links" aria-label="Footer navigation">
          <div className="footer-link-group">
            <h4 className="footer-link-heading">Product</h4>
            <Link href="/" className="footer-link">Identify</Link>
            <Link href="/contribute" className="footer-link">Contribute</Link>
            <Link href="/history" className="footer-link">History</Link>
          </div>
          <div className="footer-link-group">
            <h4 className="footer-link-heading">Legal</h4>
            <Link href="/terms" className="footer-link">Terms of Service</Link>
            <Link href="/privacy" className="footer-link">Privacy Policy</Link>
            <Link href="/copyright" className="footer-link">Copyright</Link>
          </div>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p className="footer-copyright">
          &copy; {currentYear} AlgaeAI. All rights reserved.
        </p>
        <div className="footer-bottom-links">
          <Link href="/terms">Terms</Link>
          <span className="footer-dot">·</span>
          <Link href="/privacy">Privacy</Link>
          <span className="footer-dot">·</span>
          <Link href="/copyright">Copyright</Link>
        </div>
      </div>
    </footer>
  );
}
