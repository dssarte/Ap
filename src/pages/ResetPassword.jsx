import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/api/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [validSession, setValidSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer;

    const finish = (valid, message = "") => {
      if (!active) return;
      setValidSession(valid);
      setError(message);
      setChecking(false);
      if (valid) window.history.replaceState({}, document.title, window.location.pathname);
    };

    const initializeRecovery = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const authError = url.searchParams.get("error_description") || hash.get("error_description");
        if (authError) {
          finish(false, decodeURIComponent(authError).replace(/\+/g, " "));
          return;
        }

        // Supports both Supabase PKCE links (?code=...) and implicit links (#access_token=...).
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (session) {
          finish(true);
          return;
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sessionData) => {
          if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && sessionData) finish(true);
        });

        timer = window.setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (data.session) finish(true);
          else finish(false, "This password reset link is invalid, expired, or was already used.");
          subscription.unsubscribe();
        }, 1800);
      } catch (err) {
        finish(false, err?.message || "This password reset link is invalid or has expired.");
      }
    };

    initializeRecovery();
    return () => {
      active = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!validSession) return setError("Request a new password reset link.");
    if (newPassword.length < 8) return setError("Password must contain at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setSuccess(true);
      await supabase.auth.signOut();
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <AuthLayout icon={Lock} title="Checking reset link" subtitle="Please wait"><div className="flex justify-center py-8"><Loader2 className="w-7 h-7 animate-spin" /></div></AuthLayout>;
  if (!validSession) return <AuthLayout icon={AlertTriangle} title="Invalid reset link" subtitle="This link is invalid or expired" footer={<Link to="/forgot-password" className="text-primary font-medium hover:underline">Request a new link</Link>}><div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">{error}</div></AuthLayout>;
  if (success) return <AuthLayout icon={CheckCircle2} title="Password updated" subtitle="Redirecting to login"><Loader2 className="w-5 h-5 mx-auto animate-spin" /></AuthLayout>;

  return <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
    {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="password">New Password</Label><Input id="password" type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required disabled={loading} /></div>
      <div className="space-y-2"><Label htmlFor="confirm">Confirm Password</Label><Input id="confirm" type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={loading} /></div>
      <Button type="submit" className="w-full h-12" disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{loading ? "Resetting..." : "Reset password"}</Button>
    </form>
  </AuthLayout>;
}
