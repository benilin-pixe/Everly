import React from 'react';
import { ShieldAlert, Lock, ArrowLeft, UserCheck } from 'lucide-react';
import { clearDeniedAttempt, PRIMARY_OWNER_EMAIL, SHARED_USER_EMAIL } from '../services/authService';

interface AccessDeniedProps {
  attemptedEmail: string;
  onRetry: () => void;
  onSwitchToAuthorized: (email: typeof PRIMARY_OWNER_EMAIL | typeof SHARED_USER_EMAIL) => void;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({
  attemptedEmail,
  onRetry,
  onSwitchToAuthorized,
}) => {
  return (
    <main className="min-h-screen bg-[#080b11] text-slate-200 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-rose-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-red-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-[#0e131f] border border-rose-500/20 rounded-3xl p-8 md:p-10 shadow-2xl relative z-10 text-center">
        {/* Shield icon */}
        <div className="inline-flex p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-6">
          <ShieldAlert className="w-10 h-10" />
        </div>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          Access Denied
        </h1>
        <p className="mt-2 text-rose-300 font-medium text-sm">
          Your Google account is not authorized to access Everly.
        </p>

        {/* Security Details */}
        <div className="mt-6 p-4 rounded-2xl bg-[#080b11] border border-white/5 text-left space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Attempted Account</span>
            <span className="font-mono text-rose-300 font-medium truncate max-w-[220px]">
              {attemptedEmail || 'unknown@google.com'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Access Policy</span>
            <span className="text-slate-300">Strict Whitelist (2 Authorized Accounts)</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Root Directory</span>
            <span className="font-mono text-rose-300">Google Drive: Everly Shared Storage</span>
          </div>

          <div className="pt-2 border-t border-white/5 flex items-start gap-2 text-xs text-slate-400">
            <Lock className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
            <span>
              This shared vault contains intimate photographs, private videos, and couple memories. Only verified Google accounts (<strong className="text-slate-300">{PRIMARY_OWNER_EMAIL}</strong> and <strong className="text-slate-300">{SHARED_USER_EMAIL}</strong>) are granted access.
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          <button
            onClick={() => {
              clearDeniedAttempt();
              onRetry();
            }}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-750 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Login Screen
          </button>

          <div className="pt-2">
            <span className="text-xs text-slate-500 block mb-2">Switch to Authorized Account:</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSwitchToAuthorized(PRIMARY_OWNER_EMAIL)}
                className="py-2 px-3 bg-[#131926] hover:bg-[#1a2336] text-xs font-medium text-slate-200 rounded-xl transition-colors border border-white/5 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-rose-400" />
                Ben (Owner)
              </button>
              <button
                onClick={() => onSwitchToAuthorized(SHARED_USER_EMAIL)}
                className="py-2 px-3 bg-[#131926] hover:bg-[#1a2336] text-xs font-medium text-slate-200 rounded-xl transition-colors border border-white/5 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                Ben Storage
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
