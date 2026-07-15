import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, Mail } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-[#1fd655]/5 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6979737791aaf996d5335e29/016378777_TheFigaroCoffeeGroup_logo.png"
            alt="Logo"
            className="h-20 w-auto object-contain"
          />
        </div>

        <Card className="border-2 border-slate-200 shadow-xl">
          {step === 'login' ? (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold text-slate-900">Sign In</CardTitle>
                <p className="text-slate-500 text-sm mt-1">Enter your credentials to access the HelpDesk</p>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoFocus
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        required
                        className="h-11 pr-10"
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
                      <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-slate-700 underline">
                        Forgot password?
                      </Link>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold shadow-md"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold text-slate-900">Verify Your Account</CardTitle>
                <p className="text-slate-500 text-sm mt-1">
                  Enter the 6-digit code sent to <strong>{email}</strong>
                </p>
              </CardHeader>
              <CardContent className="pt-4">
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
                    className="w-full h-11 bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold shadow-md"
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

        <p className="text-center text-xs text-slate-400 mt-6">
          © {new Date().getFullYear()} HelpDesk System
        </p>
      </div>
    </div>
  );
}