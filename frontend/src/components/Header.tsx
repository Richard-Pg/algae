"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Menu, ShieldCheck, User, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { LogoMark } from "@/components/Logo";

const NAV = [
  { href: "/", label: "Identify", match: (p: string) => p === "/" || p.startsWith("/results") },
  { href: "/species", label: "Species library", match: (p: string) => p.startsWith("/species") },
  { href: "/contribute", label: "Contribute", match: (p: string) => p.startsWith("/contribute") },
  { href: "/workspace", label: "My workspace", match: (p: string) => p.startsWith("/workspace") },
];

export default function Header() {
  const pathname = usePathname() || "/";
  const { user, me, loading, isAdmin, signOut, requestSignIn } = useAuth();
  // Each menu remembers the path it was opened on, so navigating closes it.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const [mobilePath, setMobilePath] = useState<string | null>(null);
  const menuOpen = menuPath === pathname;
  const mobileOpen = mobilePath === pathname;
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuPath(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const nav = isAdmin
    ? [...NAV, { href: "/admin", label: "Review", match: (p: string) => p.startsWith("/admin") }]
    : NAV;
  const name = me?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

  return (
    <header className="on-ink sticky top-0 z-40 border-b border-ink-line bg-ink text-ink-text">
      <div className="mx-auto flex h-15 max-w-7xl items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-ink-text">
          <LogoMark className="size-6 text-signal" />
          <span className="text-lg font-semibold tracking-tight">AlgaeAI</span>
        </Link>

        <nav aria-label="Main" className="hidden flex-1 items-center gap-7 md:flex">
          {nav.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative py-5 text-[15px] transition-colors ${
                  active ? "text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-signal" : "text-ink-soft hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {!loading && !user && (
            <button
              type="button"
              onClick={() => requestSignIn()}
              className="h-9 rounded-lg bg-signal px-4 text-sm font-medium text-ink hover:bg-[#b4dca3]"
            >
              Sign in
            </button>
          )}
          {!loading && user && (
            <div className="relative hidden md:block" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuPath(menuOpen ? null : pathname)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-ink-soft hover:bg-ink-raised hover:text-white"
              >
                <span className="grid size-7 place-items-center rounded-full bg-ink-raised font-mono text-xs text-signal ring-1 ring-ink-line">
                  {(name || "?").charAt(0).toUpperCase()}
                </span>
                <span className="max-w-32 truncate">{name}</span>
                <ChevronDown className="size-4" aria-hidden />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface text-text shadow-xl">
                  <div className="border-b border-line px-4 py-3">
                    <div className="truncate font-medium">{name}</div>
                    <div className="truncate text-xs text-muted">{user.email}</div>
                  </div>
                  <Link role="menuitem" href="/workspace" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-paper">
                    <User className="size-4 text-muted" aria-hidden /> My workspace
                  </Link>
                  {isAdmin && (
                    <Link role="menuitem" href="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-paper">
                      <ShieldCheck className="size-4 text-muted" aria-hidden /> Review queue
                    </Link>
                  )}
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => signOut()}
                    className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-sm text-risk-high hover:bg-paper"
                  >
                    <LogOut className="size-4" aria-hidden /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            className="grid size-10 place-items-center rounded-lg text-ink-soft hover:bg-ink-raised md:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobilePath(mobileOpen ? null : pathname)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav aria-label="Main" className="border-t border-ink-line px-4 pb-4 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block border-b border-ink-line py-3.5 text-base ${item.match(pathname) ? "text-white" : "text-ink-soft"}`}
            >
              {item.label}
            </Link>
          ))}
          {user && (
            <button type="button" onClick={() => signOut()} className="mt-3 py-2 text-base text-risk-high-on-ink">
              Sign out
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
