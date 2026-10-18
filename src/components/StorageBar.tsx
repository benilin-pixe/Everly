import React, { useState } from 'react';
import {
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ExternalLink,
  Upload,
  LogOut,
  Folder,
  ShieldCheck,
  Sparkles,
  Database,
  Lock,
} from 'lucide-react';
import { StorageStats, AuthorizedUser } from '../types';
import { formatBytes } from '../services/storageService';
import { PRIMARY_OWNER_EMAIL, SHARED_USER_EMAIL } from '../services/authService';
import { DriveAccountStatus } from '../services/everlyStorageService';
import { BackupStatusWidget } from './BackupStatusWidget';

interface StorageModalProps {
  stats: StorageStats & {
    driveAStatus?: DriveAccountStatus;
    driveBStatus?: DriveAccountStatus;
  };
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthorizedUser;
  onOpenUpload?: () => void;
  onRefreshStorage?: () => void;
  onToggleDriveConnection?: (provider: 'DRIVE_A' | 'DRIVE_B', isConnected: boolean) => void;
  onOpenStorageServers?: () => void;
}

export const StorageModal: React.FC<StorageModalProps> = ({
  stats,
  isOpen,
  onClose,
  currentUser,
  onOpenUpload,
  onRefreshStorage,
  onToggleDriveConnection,
  onOpenStorageServers,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!isOpen) return null;

  const usedPercent = Math.min(100, Number(((stats.usedBytes / stats.totalBytes) * 100).toFixed(1)));
  const photosPercent = Number(((stats.photosBytes / stats.totalBytes) * 100).toFixed(2));
  const videosPercent = Number(((stats.videosBytes / stats.totalBytes) * 100).toFixed(2));
  const audioPercent = Number(((stats.audioBytes / stats.totalBytes) * 100).toFixed(2));
  const docsPercent = Number(((stats.documentsBytes / stats.totalBytes) * 100).toFixed(2));

  const availableBytes = Math.max(0, stats.totalBytes - stats.usedBytes);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefreshStorage?.();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const driveA = stats.driveAStatus || {
    email: PRIMARY_OWNER_EMAIL,
    name: 'Ben Lin',
    role: 'Owner' as const,
    isConnected: true,
    usedBytes: stats.usedBytes / 2,
    totalBytes: 15 * 1024 * 1024 * 1024,
    freeBytes: 15 * 1024 * 1024 * 1024 - stats.usedBytes / 2,
    itemCount: Math.ceil(stats.itemCount / 2),
  };

  const driveB = stats.driveBStatus || {
    email: SHARED_USER_EMAIL,
    name: 'Ben Storage',
    role: 'Storage Partner' as const,
    isConnected: true,
    usedBytes: stats.usedBytes / 2,
    totalBytes: 15 * 1024 * 1024 * 1024,
    freeBytes: 15 * 1024 * 1024 * 1024 - stats.usedBytes / 2,
    itemCount: Math.floor(stats.itemCount / 2),
  };

  const isAnyDisconnected = !driveA.isConnected || !driveB.isConnected;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0c101c]/95 border border-rose-500/25 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 text-rose-300">
              <HardDrive className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-400">
                <span>Unified Virtual Storage System</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <h2 id="storage-dialog-title" className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Everly Cloud Storage
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Partial Disconnect Warning Banner */}
        {isAnyDisconnected && (
          <div className="mt-4 p-3 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Some Everly storage is temporarily unavailable because one storage account is disconnected.</span>
          </div>
        )}

        {/* Combined Quota Card */}
        <div className="mt-5 p-5 rounded-2xl bg-[#080c18] border border-white/10 space-y-3">
          <div className="flex justify-between items-baseline">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                Everly Cloud Storage Total
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Combined across 2 Connected Google Drive Accounts
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-white font-mono text-rose-300">
                {formatBytes(stats.usedBytes)}
              </span>
              <span className="text-xs text-slate-400"> used of </span>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {formatBytes(stats.totalBytes)}
              </span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="h-3.5 w-full bg-slate-900 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-white/5">
            <div
              style={{ width: `${Math.max(2, photosPercent * 6)}%` }}
              className="h-full bg-rose-500 rounded-l-full"
              title={`Photos: ${formatBytes(stats.photosBytes)}`}
            />
            <div
              style={{ width: `${Math.max(2, videosPercent * 4)}%` }}
              className="h-full bg-amber-500"
              title={`Videos: ${formatBytes(stats.videosBytes)}`}
            />
            <div
              style={{ width: `${Math.max(2, audioPercent * 6)}%` }}
              className="h-full bg-violet-500"
              title={`Music: ${formatBytes(stats.audioBytes)}`}
            />
            <div
              style={{ width: `${Math.max(2, docsPercent * 6)}%` }}
              className="h-full bg-emerald-500 rounded-r-full"
              title={`Memories: ${formatBytes(stats.documentsBytes)}`}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span>{stats.itemCount} files across 2 Drives</span>
            <span className="font-semibold text-emerald-400 font-mono">
              {formatBytes(availableBytes)} available
            </span>
          </div>
        </div>

        {/* Google Drive Backup Status & Force Sync Widget */}
        <div className="mt-5">
          <BackupStatusWidget
            variant="compact"
            onFilesUpdated={onRefreshStorage ? () => onRefreshStorage() : undefined}
          />
        </div>

        {/* Everly Cloud Storage Providers Section */}
        <div className="mt-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Everly Cloud Storage Providers</span>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Sync All</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Storage Provider A */}
            <div className="p-4 rounded-2xl bg-[#090e1a] border border-rose-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center font-bold text-white text-xs">
                    PA
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Storage Provider A</div>
                    <div className="text-[11px] text-slate-400">Primary Cloud Storage</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${driveA.isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                  {driveA.isConnected ? 'CONNECTED ✓' : 'DISCONNECTED'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-white/5">
                <span>{formatBytes(driveA.usedBytes)} used ({driveA.itemCount} files)</span>
                <button
                  onClick={() => onToggleDriveConnection?.('DRIVE_A', !driveA.isConnected)}
                  className="text-rose-400 hover:underline text-[10px] cursor-pointer"
                >
                  {driveA.isConnected ? 'Disconnect' : 'Reconnect'}
                </button>
              </div>
            </div>

            {/* Storage Provider B */}
            <div className="p-4 rounded-2xl bg-[#090e1a] border border-indigo-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs">
                    PB
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Storage Provider B</div>
                    <div className="text-[11px] text-slate-400">Partner Cloud Storage</div>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${driveB.isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                  {driveB.isConnected ? 'CONNECTED ✓' : 'DISCONNECTED'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-white/5">
                <span>{formatBytes(driveB.usedBytes)} used ({driveB.itemCount} files)</span>
                <button
                  onClick={() => onToggleDriveConnection?.('DRIVE_B', !driveB.isConnected)}
                  className="text-indigo-400 hover:underline text-[10px] cursor-pointer"
                >
                  {driveB.isConnected ? 'Disconnect' : 'Reconnect'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Everly Members Section */}
        <div className="mt-5 space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Everly Members
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#090e1a] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center">
                  BL
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Ben Lin</div>
                  <div className="text-[11px] font-mono text-slate-400">{PRIMARY_OWNER_EMAIL}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                OWNER
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#090e1a] border border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center">
                  SL
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Shana Love</div>
                  <div className="text-[11px] font-mono text-slate-400">{SHARED_USER_EMAIL}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                OWNER
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400 italic">
            "Your memories, music and moments — stored across your connected Google Drives."
          </div>

          <div className="flex items-center gap-2">
            {onOpenStorageServers && (
              <button
                onClick={() => {
                  onClose();
                  onOpenStorageServers();
                }}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/15 text-rose-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-rose-400" />
                <span>Storage Servers (Admin)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
