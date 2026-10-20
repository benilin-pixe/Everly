import React, { useState } from 'react';
import {
  Heart,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  Lock,
  Zap,
  ArrowRight,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import {
  signInWithGoogleFlow,
  signInWithGoogleRedirectFlow,
  PRIMARY_OWNER_EMAIL,
  SHARED_USER_EMAIL,
} from '../services/authService';
import { AuthorizedUser } from '../types';

interface LoginModalProps {
  onLoginSuccess: (user: AuthorizedUser) => void;
  onLoginDenied?: (attemptedEmail: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  onLoginDenied,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirectLoading, setIsRedirectLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [actionHint, setActionHint] = useState<string | null>(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Directly invokes Google OAuth popup from the user's click gesture
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorNotice(null);
    setErrorCode(null);
    setActionHint(null);
    setIsCancelled(false);

    try {
      const user = await signInWithGoogleFlow();
      onLoginSuccess(user);
    } catch (err: any) {
      console.error('[Everly Auth] Google Sign-In error:', err);

      if (err?.code === 'auth/popup-closed-by-user' || err?.isCancelled) {
        setIsCancelled(true);
        setActionHint(err?.actionHint || 'Click Continue with Google to try again.');
      } else if (err?.code === 'auth/popup-blocked' || err?.isPopupBlocked) {
        setErrorCode('auth/popup-blocked');
        setErrorNotice(err?.message || 'The Google sign-in window was blocked by your browser.');
        setActionHint(err?.actionHint || 'Click "Continue with Redirect" below or allow popups in your browser settings.');
      } else if (err?.code === 'auth/unauthorized-domain') {
        setErrorCode('auth/unauthorized-domain');
        setErrorNotice(err?.message || 'Domain not authorized in Firebase Authentication.');
        setActionHint(err?.actionHint || 'Add this domain to Authorized Domains in Firebase Console.');
      } else if (err?.code === 'auth/operation-not-allowed') {
        setErrorCode('auth/operation-not-allowed');
        setErrorNotice(err?.message || 'Google Sign-in is not enabled in Firebase Console.');
        setActionHint(err?.actionHint || 'Enable Google under Firebase Console > Authentication > Sign-in method.');
      } else if (err?.message?.includes('not authorized') || err?.attemptedEmail) {
        if (onLoginDenied && err?.attemptedEmail) {
          onLoginDenied(err.attemptedEmail);
          return;
        }
        setErrorNotice(err?.message || 'This Google account is not authorized to access Everly.');
      } else {
        setErrorNotice(err?.message || 'Google sign-in could not be completed. Please try again.');
        if (err?.code) setErrorCode(err.code);
        if (err?.actionHint) setActionHint(err.actionHint);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Directly invokes Google OAuth redirect flow
  const handleRedirectSignIn = async () => {
    setIsRedirectLoading(true);
    setErrorNotice(null);
    try {
      await signInWithGoogleRedirectFlow();
    } catch (err: any) {
      console.error('[Everly Auth] Google Redirect Sign-In error:', err);
      setErrorNotice(err?.message || 'Could not initiate redirect sign-in. Please try again.');
      setIsRedirectLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070a10] text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-rose-950/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-950/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-10 left-10 w-64 h-64 bg-violet-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0e131f]/95 backdrop-blur-xl border border-white/10 rounded-3xl p-7 sm:p-10 shadow-2xl relative z-10 text-center">
        {/* Brand Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600/20 via-pink-600/20 to-indigo-600/20 border border-rose-500/30 text-rose-400 mb-4 shadow-inner">
            <Heart className="w-8 h-8 fill-rose-500/30 text-rose-400" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Everly</span>
            <Sparkles className="w-5 h-5 text-amber-300" />
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-rose-300/80 font-medium">
            Private media vault & shared moments
          </p>
        </div>

        {/* Cancellation Notice */}
        {isCancelled && !errorNotice && (
          <div className="mb-6 p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/30 text-amber-200 text-xs text-left flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block text-amber-300">Sign-in Window Closed</span>
              <span>{actionHint || 'Click the button below to resume signing in with your Google account.'}</span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorNotice && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs text-left flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-2 flex-1">
              <div>
                <span className="font-semibold block text-rose-300">
                  {errorCode ? `Sign-In Notice (${errorCode})` : 'Authentication Notice'}
                </span>
                <span className="text-rose-200/90 leading-relaxed block mt-0.5">{errorNotice}</span>
              </div>
              {actionHint && (
                <div className="p-2 rounded-lg bg-black/30 border border-white/5 text-[11px] text-rose-300">
                  <span className="font-semibold block text-white">How to fix:</span>
                  <span>{actionHint}</span>
                </div>
              )}
              {errorCode === 'auth/popup-blocked' && (
                <button
                  type="button"
                  onClick={handleRedirectSignIn}
                  disabled={isRedirectLoading}
                  className="w-full mt-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isRedirectLoading ? 'Redirecting to Google...' : 'Continue with Redirect Instead'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Primary Action: Official Continue with Google Button */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isRedirectLoading}
            className="w-full py-4 px-6 bg-white hover:bg-slate-100 active:scale-[0.99] text-slate-900 rounded-2xl font-bold text-sm shadow-xl shadow-black/40 hover:shadow-white/10 transition-all flex items-center justify-center gap-3.5 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed group border border-slate-200"
            aria-label="Continue with Google"
          >
            {isLoading ? (
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                <span className="text-slate-900 font-semibold">Opening Google Sign-In...</span>
              </div>
            ) : (
              <>
                {/* Official Google G Logo */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="text-slate-900 group-hover:text-black">
                  Continue with Google
                </span>
                <ArrowRight className="w-4 h-4 ml-auto text-slate-400 group-hover:text-slate-700 transition-colors" />
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-400 leading-relaxed px-2">
            Sign in with your verified Google account. No separate Everly password or registration required.
          </p>
        </div>

        {/* Security & Access Policy Badges */}
        <div className="mt-7 pt-5 border-t border-white/5 space-y-3">
          <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 text-left text-xs text-slate-300 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-white block">Authorized Access Only</span>
              <span className="text-slate-400">
                Exclusive couple portal. Access is strictly limited to verified Google accounts:
              </span>
              <div className="mt-1 font-mono text-[10px] space-y-0.5 text-rose-300">
                <div>• {PRIMARY_OWNER_EMAIL} <span className="text-emerald-400 font-sans font-semibold">(Owner)</span></div>
                <div>• {SHARED_USER_EMAIL} <span className="text-indigo-400 font-sans font-semibold">(Member)</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02]">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-medium text-slate-300">Firebase OAuth</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02]">
              <Lock className="w-4 h-4 text-rose-400" />
              <span className="font-medium text-slate-300">No Passwords</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02]">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-medium text-slate-300">Instant Access</span>
            </div>
          </div>

          {/* Optional troubleshooting dropdown */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
              className="text-[11px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showTroubleshooting ? 'Hide details' : 'Having trouble signing in?'}</span>
            </button>

            {showTroubleshooting && (
              <div className="mt-2.5 p-3 rounded-xl bg-[#090d15] border border-white/10 text-left text-[11px] text-slate-300 space-y-2 animate-in fade-in">
                <p className="text-slate-400">
                  If the popup window doesn't appear, your browser may be blocking popups for this site.
                </p>
                <button
                  type="button"
                  onClick={handleRedirectSignIn}
                  disabled={isRedirectLoading}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isRedirectLoading ? 'Redirecting...' : 'Use Redirect Flow Instead'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
