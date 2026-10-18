import React, { useState } from 'react';
import {
  Lock,
  Heart,
  ShieldCheck,
  Mail,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  KeyRound,
  User,
} from 'lucide-react';
import {
  AUTHORIZED_USERS,
  PRIMARY_OWNER_EMAIL,
  SHARED_USER_EMAIL,
  checkAccountSetupStatus,
  setupOwnerPasswordApi,
  loginWithPasswordApi,
  resetOwnerPasswordApi,
} from '../services/authService';
import { AuthorizedUser } from '../types';

interface LoginModalProps {
  onLoginSuccess: (user: AuthorizedUser) => void;
  onLoginDenied: (attemptedEmail: string) => void;
}

type AuthMode = 'select' | 'login' | 'setup' | 'reset';

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  onLoginDenied,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<string>(PRIMARY_OWNER_EMAIL);
  const [mode, setMode] = useState<AuthMode>('select');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [debugHint, setDebugHint] = useState<string | null>(null);

  const handleSelectAccount = async (email: string) => {
    setSelectedEmail(email);
    setErrorNotice(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      const status = await checkAccountSetupStatus(email);
      if (status.debugSetupToken) {
        setDebugHint(status.debugSetupToken);
      }
      if (status.isSetupComplete) {
        setMode('login');
      } else {
        setMode('setup');
      }
    } catch (err: any) {
      setErrorNotice(err?.message || 'Could not verify account status.');
      setMode('login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorNotice('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      const user = await loginWithPasswordApi(selectedEmail, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupToken.trim()) {
      setErrorNotice('Please enter your secure setup invitation token.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorNotice('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorNotice('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      const user = await setupOwnerPasswordApi(selectedEmail, setupToken.trim(), password);
      setSuccessNotice('Password successfully configured! Logging you in...');
      setTimeout(() => {
        onLoginSuccess(user);
      }, 800);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Password setup failed. Check your setup token.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupToken.trim()) {
      setErrorNotice('Please enter your recovery setup token.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorNotice('New password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorNotice('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorNotice(null);

    try {
      await resetOwnerPasswordApi(selectedEmail, setupToken.trim(), password);
      setSuccessNotice('Password successfully reset! Please log in.');
      setMode('login');
      setPassword('');
      setConfirmPassword('');
      setSetupToken('');
    } catch (err: any) {
      setErrorNotice(err?.message || 'Password reset failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userInfo = AUTHORIZED_USERS[selectedEmail] || { name: 'Owner', role: 'Owner', avatarInitials: 'O', avatarColor: 'from-rose-500 to-amber-600' };

  return (
    <main className="min-h-screen bg-[#070a10] text-slate-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-rose-950/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-indigo-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0e131f] border border-white/10 rounded-3xl p-7 md:p-9 shadow-2xl relative z-10">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600/20 to-indigo-600/20 border border-rose-500/30 text-rose-400 mb-3 shadow-inner">
            <Heart className="w-7 h-7 fill-rose-500/30 text-rose-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Everly</span>
            <Sparkles className="w-4 h-4 text-amber-300" />
          </h1>
          <p className="mt-1 text-xs text-rose-300 font-medium">
            Strict Two-Owner Security Vault · Isolated Private Sessions
          </p>
        </div>

        {/* Security badge */}
        <div className="mb-6 p-3 bg-[#080b12] border border-white/5 rounded-2xl flex items-start gap-2.5 text-xs text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Authorized Owner Accounts Only</span>
            <p className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
              Exclusively restricted between <strong className="text-rose-300">BeniLin</strong> and <strong className="text-indigo-300">Shana Love</strong>. Account isolation is strictly enforced.
            </p>
          </div>
        </div>

        {/* Notifications */}
        {errorNotice && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorNotice}</span>
          </div>
        )}

        {successNotice && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Debug / Dev Setup Token Notice */}
        {debugHint && (
          <div className="mb-4 p-3 rounded-2xl bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 text-[11px]">
            <span className="font-semibold block mb-0.5">🔒 Setup Invitation Token (Dev Mode):</span>
            <code className="bg-black/40 px-2 py-0.5 rounded text-amber-300 select-all font-mono">{debugHint}</code>
          </div>
        )}

        {/* MODE 1: SELECT ACCOUNT */}
        {mode === 'select' && (
          <div className="space-y-3">
            <label className="text-xs font-semibold text-slate-400 block mb-1">
              Select your authorized owner account:
            </label>

            {/* BeniLin */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectAccount(PRIMARY_OWNER_EMAIL)}
              className="w-full p-4 bg-[#141b29] hover:bg-[#1a2336] active:scale-[0.99] border border-white/10 hover:border-rose-500/40 rounded-2xl transition-all flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
                  BL
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors">
                    BeniLin
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    {PRIMARY_OWNER_EMAIL}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                  OWNER
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
            </button>

            {/* Shana Love */}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSelectAccount(SHARED_USER_EMAIL)}
              className="w-full p-4 bg-[#141b29] hover:bg-[#1a2336] active:scale-[0.99] border border-white/10 hover:border-indigo-500/40 rounded-2xl transition-all flex items-center justify-between text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
                  SL
                </div>
                <div>
                  <div className="text-sm font-bold text-white group-hover:text-indigo-200 transition-colors">
                    Shana Love
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    {SHARED_USER_EMAIL}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                  OWNER
                </span>
                <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
              </div>
            </button>
          </div>
        )}

        {/* MODE 2: PASSWORD LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#121826] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${userInfo.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                  {userInfo.avatarInitials}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{userInfo.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">{selectedEmail}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode('select')}
                className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Enter Private Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#141b29] border border-slate-800 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In Securely'}
            </button>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <button
                type="button"
                onClick={() => {
                  setMode('setup');
                  setSetupToken(debugHint || '');
                }}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                First-time setup?
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setSetupToken(debugHint || '');
                }}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reset password?
              </button>
            </div>
          </form>
        )}

        {/* MODE 3: FIRST-TIME PASSWORD SETUP */}
        {mode === 'setup' && (
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#121826] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${userInfo.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                  {userInfo.avatarInitials}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Initial Setup: {userInfo.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">{selectedEmail}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode('select')}
                className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
              >
                Back
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Secure Setup Invitation Token</span>
              </label>
              <input
                type="text"
                required
                placeholder="Enter setup invitation token"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                className="w-full bg-[#141b29] border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Create Private Password (Min. 6 chars)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#141b29] border border-slate-800 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Confirm Private Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#141b29] border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Configuring Password...' : 'Complete Secure Setup'}
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Already set up? Sign in instead
              </button>
            </div>
          </form>
        )}

        {/* MODE 4: PASSWORD RESET */}
        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-[#121826] rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${userInfo.avatarColor} flex items-center justify-center text-white text-xs font-bold`}>
                  {userInfo.avatarInitials}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Reset: {userInfo.name}</div>
                  <div className="text-[11px] font-mono text-slate-400">{selectedEmail}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-[11px] text-indigo-400 hover:underline cursor-pointer"
              >
                Back to Login
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Security Recovery Setup Token
              </label>
              <input
                type="text"
                required
                placeholder="Enter recovery token"
                value={setupToken}
                onChange={(e) => setSetupToken(e.target.value)}
                className="w-full bg-[#141b29] border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#141b29] border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Confirm New Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#141b29] border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-2xl font-bold text-xs shadow-lg shadow-rose-950/50 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
};
