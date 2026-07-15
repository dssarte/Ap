import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, Mail, CheckCircle2, ShieldCheck, BarChart3 } from "lucide-react";

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6979737791aaf996d5335e29/016378777_TheFigaroCoffeeGroup_logo.png';

const NEEDS_VERIFICATION_HINTS = ['verify', 'verification', 'otp', 'confirm your'];

export default function Login() {
  const [step, setStep] = useState('login'); // 'login' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Check if this is an admin-created account logging in for the first time.
      // If so, the real account + OTP email are only created/sent right now.
      const res = await base44.functions.invoke('completeFirstLogin', { email, password });
      if (res.data?.isPending) {
        if (res.data?.success) {
          setStep('otp');
        } else {
          setError(res.data?.error || 'Invalid email or password. Please try again.');
        }
        return;
      }

      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = '/';
    } catch (err) {
      const msg = err?.message || '';
      const needsVerification = err?.status === 403 || NEEDS_VERIFICATION_HINTS.some(hint => msg.toLowerCase().includes(hint));
      if (needsVerification) {
        try {
          await base44.auth.resendOtp(email);
          setStep('otp');
        } catch (otpErr) {
          setError(otpErr?.message || 'Failed to send verification code. Please try again.');
        }
      } else {
        setError(msg || 'Invalid email or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await base44.auth.verifyOtp({ email, otpCode });
      base44.auth.setToken(access_token);
      window.location.href = '/';
    } catch (err) {
      setError(err?.message || 'Invalid or expired code. Try resending.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      await base44.auth.resendOtp(email);
    } catch (err) {
      setError(err?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)]">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,#10b981_0,transparent_34%),radial-gradient(circle_at_85%_75%,#166534_0,transparent_32%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative">
          <div className="inline-flex rounded-2xl bg-white px-5 py-3 shadow-xl shadow-black/10">
            <img src={LOGO_URL} alt="Figaro Coffee Group" className="h-12 w-auto object-contain" />
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">Internal operations workspace</p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Support that keeps every store moving.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">Manage requests, approvals, and quality audits in one secure, reliable place built for the Figaro team.</p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"><CheckCircle2 className="mb-3 h-5 w-5 text-emerald-400" /><p className="text-sm font-medium">Faster resolution</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"><ShieldCheck className="mb-3 h-5 w-5 text-emerald-400" /><p className="text-sm font-medium">Secure access</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"><BarChart3 className="mb-3 h-5 w-5 text-emerald-400" /><p className="text-sm font-medium">Clear insights</p></div>
          </div>
        </div>
        <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} Figaro Coffee Group</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-10 lg:bg-white">
      <div className="w-full max-w-md">
        <div className="mb-9 lg:hidden">
          <img src={LOGO_URL} alt="Figaro Coffee Group" className="h-14 w-auto object-contain" />
        </div>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm lg:border-0 lg:shadow-none">
          {step === 'login' ? (
            <>
              <CardHeader className="px-6 pb-3 pt-7 text-left sm:px-8 lg:px-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Welcome back</p>
                <CardTitle className="text-3xl font-bold tracking-tight text-slate-950">Sign in to your account</CardTitle>
                <p className="mt-2 text-sm leading-6 text-slate-500">Use your work credentials to access the support and audit workspace.</p>
              </CardHeader>
              <CardContent className="px-6 pb-7 pt-4 sm:px-8 lg:px-0">
                <form onSubmit={handleLogin} className="space-y-5">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-semibold text-slate-700">Work email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@figaro.ph"
                      required
                      autoFocus
                      className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 shadow-none focus:bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        required
                        className="h-12 rounded-xl border-slate-200 bg-slate-50 px-4 pr-11 shadow-none focus:bg-white"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <div className="text-right">
                      <Link to="/forgot-password" className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-xl bg-emerald-700 font-semibold text-white shadow-sm hover:bg-emerald-800"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="px-6 pb-3 pt-7 text-left sm:px-8 lg:px-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">One more step</p>
                <CardTitle className="text-3xl font-bold tracking-tight text-slate-950">Verify your account</CardTitle>
                <p className="text-slate-500 text-sm mt-1">
                  Enter the 6-digit code sent to <strong>{email}</strong>
                </p>
              </CardHeader>
              <CardContent className="px-6 pb-7 pt-4 sm:px-8 lg:px-0">
                <form onSubmit={handleVerify} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label>6-Digit Code</Label>
                    <Input
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="text-center text-2xl tracking-widest font-mono h-14"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="h-12 w-full rounded-xl bg-emerald-700 font-semibold text-white shadow-sm hover:bg-emerald-800"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-slate-500 gap-2"
                    onClick={handleResend}
                    disabled={loading}
                  >
                    <Mail className="w-4 h-4" /> Resend Code
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-slate-400 hover:text-slate-600 underline"
                    onClick={() => { setStep('login'); setOtpCode(''); setError(''); }}
                  >
                    Back to Sign In
                  </button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

      </div>
      </section>
    </div>
  );
}
