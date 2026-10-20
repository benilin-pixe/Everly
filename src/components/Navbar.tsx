import React, { useState } from 'react';
import { AuthorizedUser } from '../types';
import {
  Image,
  Film,
  Music,
  FileText,
  UploadCloud,
  LogOut,
  HardDrive,
  Heart,
  ChevronDown,
  Sparkles,
  MessageSquareHeart,
  Radio,
  Palette,
  MessageSquare,
  Server,
  LogIn,
} from 'lucide-react';

export type TabType = 'moments' | 'cinema' | 'music' | 'vault' | 'board' | 'dropzone';

interface NavbarProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  currentUser: AuthorizedUser | null;
  onLogout: () => void;
  storageUsagePercent: number;
  onOpenStorageModal: () => void;
  onOpenSoundtrackManager?: () => void;
  onOpenThemeModal?: () => void;
  onOpenStorageServers?: () => void;
  unreadMessagesCount?: number;
  onOpenLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onLogout,
  storageUsagePercent,
  onOpenStorageModal,
  onOpenSoundtrackManager,
  onOpenThemeModal,
  onOpenStorageServers,
  unreadMessagesCount = 0,
  onOpenLogin,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'moments', label: 'Moments', icon: <Image className="w-4 h-4" /> },
    { id: 'cinema', label: 'Cinema', icon: <Film className="w-4 h-4" /> },
    { id: 'music', label: 'Music Box', icon: <Music className="w-4 h-4" /> },
    { id: 'vault', label: 'Vault', icon: <FileText className="w-4 h-4" /> },
    { id: 'board', label: 'Message Board', icon: <MessageSquareHeart className="w-4 h-4 text-rose-400" /> },
    { id: 'dropzone', label: 'Dropzone', icon: <UploadCloud className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-[#080b12]/90 backdrop-blur-xl border-b border-rose-500/15 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onSelectTab('moments')}
          className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-rose-300 transition-colors flex items-center gap-2.5 shrink-0 cursor-pointer"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 animate-pulse shadow-md shadow-rose-500/50" />
          <span className="font-extrabold bg-gradient-to-r from-white via-rose-100 to-rose-300 bg-clip-text text-transparent">
            Everly
          </span>
          <span className="hidden lg:inline text-[11px] text-rose-300/80 font-normal pl-1.5 border-l border-white/10 tracking-wide">
            Moments worth keeping
          </span>
        </button>

        {/* Zone 2: Navigation tabs with single-line labels */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm shadow-rose-950/40'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Storage quota button and Active user profile OR Guest Continue with Google button */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {!currentUser ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenLogin}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Continue with Google</span>
              </button>
            </div>
          ) : (
            <>
              {/* Theme Studio Button */}
              {onOpenThemeModal && (
                <button
                  onClick={onOpenThemeModal}
                  title="Appearance & Theme Studio"
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#121624] hover:bg-[#181e30] border border-white/10 hover:border-rose-500/30 rounded-xl text-xs text-slate-300 hover:text-white transition-colors cursor-pointer shadow-sm"
                >
                  <Palette className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline font-medium">Themes</span>
                </button>
              )}

              {/* Storage Quota Trigger */}
              <button
                onClick={onOpenStorageModal}
                title="Google Drive Storage Usage"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#121624] hover:bg-[#181e30] border border-white/10 hover:border-rose-500/30 rounded-xl text-xs text-slate-300 transition-colors cursor-pointer"
              >
                <HardDrive className="w-3.5 h-3.5 text-rose-400" />
                <span className="font-mono tabular-nums">{storageUsagePercent}%</span>
                <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full"
                    style={{ width: `${Math.max(5, storageUsagePercent)}%` }}
                  />
                </div>
              </button>

              {/* User Profile Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 bg-[#121624] hover:bg-[#181e30] border border-white/10 hover:border-rose-500/30 rounded-xl text-xs text-white transition-colors cursor-pointer"
                  aria-label="User profile menu"
                >
                  <div
                    className={`w-6 h-6 rounded-lg bg-gradient-to-br ${currentUser.avatarColor} flex items-center justify-center font-bold text-[11px] text-white shadow-sm overflow-hidden`}
                  >
                    {currentUser.picture ? (
                      <img src={currentUser.picture} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      currentUser.avatarInitials
                    )}
                  </div>
                  <span className="hidden sm:inline font-medium text-slate-200">
                    {currentUser.name}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-[#121624] border border-white/10 rounded-2xl shadow-2xl p-2 z-50 text-xs animate-in fade-in zoom-in-95">
                      <div className="px-3 py-2 border-b border-white/5">
                        <div className="font-semibold text-white truncate">{currentUser.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {currentUser.email}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-rose-400 font-medium">
                          <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                          <span>{currentUser.role}</span>
                        </div>
                      </div>

                      <div className="py-1">
                        {onOpenThemeModal && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenThemeModal();
                            }}
                            className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Palette className="w-3.5 h-3.5 text-rose-400" />
                            <span>Appearance & Themes</span>
                          </button>
                        )}
                        {onOpenSoundtrackManager && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenSoundtrackManager();
                            }}
                            className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Radio className="w-3.5 h-3.5 text-rose-400" />
                            <span>Soundtrack Manager</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenStorageModal();
                          }}
                          className="w-full px-3 py-2 text-left text-slate-300 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 transition-colors md:hidden cursor-pointer"
                        >
                          <HardDrive className="w-3.5 h-3.5 text-rose-400" />
                          <span>Drive Storage: {storageUsagePercent}%</span>
                        </button>
                        {onOpenStorageServers && (
                          <button
                            onClick={() => {
                              setIsUserMenuOpen(false);
                              onOpenStorageServers();
                            }}
                            className="w-full px-3 py-2 text-left text-rose-300 hover:text-white hover:bg-rose-500/10 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            <Server className="w-3.5 h-3.5 text-rose-400" />
                            <span className="font-medium">Storage Servers (Admin)</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full px-3 py-2 text-left text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
