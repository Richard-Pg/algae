import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 md:grid-cols-[2fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 text-text">
            <LogoMark className="size-5 text-brand" />
            <span className="font-semibold">AlgaeAI</span>
          </Link>
          <p className="mt-3 max-w-sm text-sm text-muted">
            An open, expert-reviewed database of algae and diatoms, with AI-assisted identification as a starting
            point for your own observation.
          </p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2 text-sm">
          <span className="label mb-1">Explore</span>
          <Link href="/" className="text-muted hover:text-text">Identify</Link>
          <Link href="/species" className="text-muted hover:text-text">Species library</Link>
          <Link href="/contribute" className="text-muted hover:text-text">Contribute</Link>
        </nav>
        <nav aria-label="Legal" className="flex flex-col gap-2 text-sm">
          <span className="label mb-1">Legal</span>
          <Link href="/terms" className="text-muted hover:text-text">Terms of Service</Link>
          <Link href="/privacy" className="text-muted hover:text-text">Privacy Policy</Link>
          <Link href="/copyright" className="text-muted hover:text-text">Copyright</Link>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-muted sm:px-8">
          © {new Date().getFullYear()} AlgaeAI.
        </p>
      </div>
    </footer>
  );
}
