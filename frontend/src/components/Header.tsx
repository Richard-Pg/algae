"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import AuthModal from "@/components/AuthModal";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "haiming.peng@outlook.com";

export default function Header() {
    const pathname = usePathname();
    const { user, loading, signOut } = useAuth();
    const [showAuth, setShowAuth] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const isAdmin = user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getInitials = () => {
        if (!user) return "?";
        const name = user.user_metadata?.display_name || user.email || "?";
        return name.charAt(0).toUpperCase();
    };

    return (
        <>
            <header className="header">
                <div className="header-inner">
                    <Link href="/" className="header-logo" style={{ textDecoration: "none" }}>
                        <div className="logo-icon">🔬</div>
                        <span>AlgaeAI</span>
                    </Link>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                        <nav className="header-nav">
                            <Link
                                href="/"
                                className={`nav-link ${pathname === "/" ? "active" : ""}`}
                            >
                                Identify
                            </Link>
                            {/* Hide top-level History link if logged in, it lives in the dashboard now */}
                            {!user && !loading && (
                                <Link
                                    href="/history"
                                    className={`nav-link ${pathname === "/history" ? "active" : ""}`}
                                >
                                    History
                                </Link>
                            )}
                            {user && !loading && (
                                <Link
                                    href="/dashboard"
                                    className={`nav-link ${pathname === "/dashboard" ? "active" : ""}`}
                                >
                                    Dashboard
                                </Link>
                            )}
                            {user && !loading && (
                                <Link
                                    href="/contribute"
                                    className={`nav-link ${pathname === "/contribute" ? "active" : ""}`}
                                >
                                    Contribute
                                </Link>
                            )}
                            {isAdmin && !loading && (
                                <Link
                                    href="/admin"
                                    className={`nav-link ${pathname === "/admin" ? "active" : ""}`}
                                >
                                    Admin
                                </Link>
                            )}
                        </nav>
                        
                        <div className="header-auth">
                            {loading ? null : user ? (
                                <div className="user-dropdown-container" ref={dropdownRef}>
                                    <button 
                                        className="user-avatar-btn" 
                                        onClick={() => setDropdownOpen(!dropdownOpen)}
                                        aria-label="User menu"
                                    >
                                        {getInitials()}
                                    </button>
                                    
                                    {dropdownOpen && (
                                        <div className="user-dropdown-menu fade-in">
                                            <div className="dropdown-header">
                                                <div className="dropdown-name">
                                                    {user.user_metadata?.display_name || "User"}
                                                </div>
                                                <div className="dropdown-email">{user.email}</div>
                                            </div>
                                            <div className="dropdown-divider"></div>
                                            <Link 
                                                href="/dashboard" 
                                                className="dropdown-item"
                                                onClick={() => setDropdownOpen(false)}
                                            >
                                                👤 Dashboard
                                            </Link>
                                            <Link 
                                                href="/history" 
                                                className="dropdown-item"
                                                onClick={() => setDropdownOpen(false)}
                                            >
                                                🗂️ My History
                                            </Link>
                                            {isAdmin && (
                                                <Link 
                                                    href="/admin" 
                                                    className="dropdown-item"
                                                    onClick={() => setDropdownOpen(false)}
                                                >
                                                    🛡️ Admin Review
                                                </Link>
                                            )}
                                            <div className="dropdown-divider"></div>
                                            <button 
                                                className="dropdown-item text-danger"
                                                onClick={() => {
                                                    setDropdownOpen(false);
                                                    signOut();
                                                }}
                                            >
                                                🚪 Sign Out
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <button
                                    className="auth-btn auth-btn-filled"
                                    onClick={() => setShowAuth(true)}
                                >
                                    Sign In
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>
            <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
        </>
    );
}
