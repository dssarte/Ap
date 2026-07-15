import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Mail } from "lucide-react";

export default function VerifyAccount() {
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [cameFromLink, setCameFromLink] = useState(false);
  // If email is in URL params, skip straight to otp step
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'done'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
      setStep('otp');
      setCameFromLink(true);
    }
  }, []);

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await base44.auth.resendOtp(email);
      setStep('otp');
    } catch (err) {
      setError(err?.message || 'Failed to send code. Check the email and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await base44.auth.verifyOtp({ email, otpCode });
      setStep('done');
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
      alert('A new code has been sent to your email.');
    } catch (err) {
      setError(err?.message || 'Failed to resend code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xl p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6979737791aaf996d5335e29/016378777_TheFigaroCoffeeGroup_logo.png"
              alt="Logo"
              className="h-16 object-contain"
            />
          </div>

          {step === 'done' ? (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-16 h-16 text-[#1fd655] mx-auto" />
              <h1 className="text-2xl font-bold text-slate-900">Account Verified!</h1>
              <p className="text-slate-600">Your account has been successfully verified. You can now log in.</p>
              <Button
                className="w-full bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-11"
                onClick={() => base44.auth.redirectToLogin()}
              >
                Go to Login
              </Button>
            </div>

          ) : step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              <div className="text-center mb-2">
                <h1 className="text-2xl font-bold text-slate-900">Verify Your Account</h1>
                <p className="text-slate-500 text-sm mt-1">Enter your email and we'll send you a verification code</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{error}</div>
              )}
              <div className="space-y-1">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="h-11"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-11">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </form>

          ) : (
            <form onSubmit={handleVerify} className="space-y-5">
              <div className="text-center mb-2">
                <h1 className="text-2xl font-bold text-slate-900">Enter Your Code</h1>
                {cameFromLink ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-slate-500 text-sm">Check your inbox for a <strong>"Verify your email"</strong> email.</p>
                    <p className="text-slate-500 text-sm">Copy the 6-digit code and paste it below.</p>
                  </div>
                ) : (
                  <p className="text-slate-500 text-sm mt-1">
                    Enter the 6-digit code sent to <strong>{email}</strong>
                  </p>
                )}
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{error}</div>
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
                className="w-full bg-[#1fd655] hover:bg-[#1bd64d] text-slate-900 font-bold h-11"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {loading ? 'Verifying...' : 'Verify Account'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-500"
                onClick={handleResend}
                disabled={loading}
              >
                Resend Code
              </Button>
              <button
                type="button"
                className="w-full text-xs text-slate-400 hover:text-slate-600 underline"
                onClick={() => { setStep('email'); setOtpCode(''); setError(''); }}
              >
                Use a different email
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}