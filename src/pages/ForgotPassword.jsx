import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await base44.auth.resetPasswordRequest(email);
      setSent(true);
    } catch (err) {
      const message = err?.message || "Unable to send the reset email.";
      setError(message.toLowerCase().includes('rate limit') ? 'Too many reset emails were requested. Please wait and try again later.' : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout icon={Mail} title="Reset password" subtitle="We'll send you a link to reset it"
      footer={<Link to="/login" className="text-primary font-medium hover:underline"><ArrowLeft className="w-3 h-3 inline mr-1" />Back to log in</Link>}>
      {sent ? (
        <div className="space-y-4 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-600" />
          <p className="text-sm">If an account exists for <strong>{email.trim()}</strong>, a reset link will arrive shortly.</p>
          <Button variant="outline" className="w-full" onClick={() => { setSent(false); setError(''); }}>Send another link</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required disabled={loading} />
            </div>
          </div>
          <Button type="submit" className="w-full h-12" disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{loading ? 'Sending...' : 'Send reset link'}</Button>
        </form>
      )}
    </AuthLayout>
  );
}
