"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    message?: string;
}

export default function AuthModal({ isOpen, onClose, message }: AuthModalProps) {
    const { signIn, signUp, resetPassword } = useAuth();
    const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signup");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (mode === "forgot") {
            if (!email) {
                setError("Please enter your email address.");
                return;
            }
            setLoading(true);
            const { error } = await resetPassword(email);
            if (error) {
                setError(error);
            } else {
                setSuccess("Password reset link sent! Please check your email inbox (and spam folder).");
            }
            setLoading(false);
            return;
        }

        if (!email || !password) {
            setError("Please fill in all fields.");
            return;
        }

        if (mode === "signup" && password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        if (mode === "signup") {
            const { error } = await signUp(email, password);
            if (error) {
                setError(error);
            } else {
                setSuccess("Account created! Please check your email to verify, then sign in.");
                setMode("signin");
                setPassword("");
                setConfirmPassword("");
            }
        } else {
            const { error } = await signIn(email, password);
            if (error) {
                setError(error);
            } else {
                onClose();
            }
        }

        setLoading(false);
    };

    const switchMode = () => {
        setMode(mode === "signin" ? "signup" : "signin");
        setError(null);
        setSuccess(null);
        setPassword("");
        setConfirmPassword("");
    };

    const goToForgot = () => {
        setMode("forgot");
        setError(null);
        setSuccess(null);
        setPassword("");
        setConfirmPassword("");
    };

    const backToSignIn = () => {
        setMode("signin");
        setError(null);
        setSuccess(null);
    };

    const getTitle = () => {
        if (mode === "forgot") return "🔒 Reset Password";
        if (mode === "signin") return "🔑 Sign In";
        return "📝 Create Account";
    };

    return (
        <div className="camera-modal-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
                <div className="camera-modal-header">
                    <h3>{getTitle()}</h3>
                    <button className="camera-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="auth-modal-body">
                    {message && (
                        <div className="auth-message">
                            {message}
                        </div>
                    )}

                    {success && (
                        <div className="auth-success">
                            ✅ {success}
                        </div>
                    )}

                    {error && (
                        <div className="auth-error">
                            ❌ {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="auth-field">
                            <label htmlFor="auth-email">Email</label>
                            <input
                                id="auth-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                autoComplete="email"
                                disabled={loading}
                            />
                        </div>

                        {mode !== "forgot" && (
                            <div className="auth-field">
                                <label htmlFor="auth-password">Password</label>
                                <input
                                    id="auth-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                                    disabled={loading}
                                />
                            </div>
                        )}

                        {mode === "signup" && (
                            <div className="auth-field">
                                <label htmlFor="auth-confirm-password">Confirm Password</label>
                                <input
                                    id="auth-confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                    disabled={loading}
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            className="upload-btn upload-btn-primary auth-submit"
                            disabled={loading}
                        >
                            {loading
                                ? "Please wait..."
                                : mode === "forgot"
                                    ? "Send Reset Link"
                                    : mode === "signin"
                                        ? "Sign In"
                                        : "Create Account"
                            }
                        </button>
                    </form>

                    {mode === "signin" && (
                        <div className="auth-forgot">
                            <button onClick={goToForgot} id="forgot-password-btn">
                                Forgot your password?
                            </button>
                        </div>
                    )}

                    {mode === "forgot" ? (
                        <div className="auth-switch">
                            <p>Remember your password? <button onClick={backToSignIn}>Sign in</button></p>
                        </div>
                    ) : (
                        <div className="auth-switch">
                            {mode === "signin" ? (
                                <p>Don&apos;t have an account? <button onClick={switchMode}>Sign up</button></p>
                            ) : (
                                <p>Already have an account? <button onClick={switchMode}>Sign in</button></p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
