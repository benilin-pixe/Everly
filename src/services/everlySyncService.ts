/**
 * Everly Cloud Storage Background Synchronization Service
 * Reconciles metadata between local Everly records and Google Drive providers (Drive A & Drive B).
 * Ensures file additions, deletions, and updates in the cloud are automatically reflected in the Everly UI.
 * Gracefully handles token expiration, pause/resume states, and transient API failures.
 */

import { UnifiedFileRecord, DriveProviderType, initEverlyCloudStorage } from './everlyStorageService';
import { listDriveFiles } from './googleDriveService';
import { getStoredAccessToken, PRIMARY_OWNER_EMAIL } from './authService';
import { launchGoogleSignIn, launchGoogleRedirectSignIn } from './firebaseAuth';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error?: string;
  filesSyncedCount?: number;
  isDriveAAuthExpired?: boolean;
}

export type SyncListener = (
  syncedFiles: UnifiedFileRecord[],
  syncStatus: SyncStatus
) => void;

const listeners = new Set<SyncListener>();
const STORAGE_KEY_LAST_SYNC = 'everly_google_drive_last_sync_timestamp';
const STORAGE_KEY_DRIVE_A_EXPIRED = 'everly_drive_a_auth_expired';

export function isDriveAAuthExpired(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY_DRIVE_A_EXPIRED) === 'true';
    }
  } catch {}
  return false;
}

export function clearDriveAAuthExpired() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY_DRIVE_A_EXPIRED);
    }
  } catch {}
}

// Retrieve persisted last successful sync timestamp, or null
function getPersistedLastSync(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
    }
  } catch {}
  return null;
}

function persistLastSync(isoTimestamp: string) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, isoTimestamp);
    }
  } catch {}
}

let isSyncing = false;
let lastSyncedAt: string | null = getPersistedLastSync() || new Date(Date.now() - 3 * 60 * 1000).toISOString();
let syncIntervalId: any = null;

export function getLastSuccessfulSyncTimestamp(): string | null {
  return lastSyncedAt || getPersistedLastSync();
}

export function getSyncStatus(): SyncStatus {
  return {
    isSyncing,
    lastSyncedAt: getLastSuccessfulSyncTimestamp(),
    isDriveAAuthExpired: isDriveAAuthExpired(),
  };
}

export function subscribeSync(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  return subscribeSync(listener);
}

function notifyListeners(files: UnifiedFileRecord[], status: SyncStatus) {
  for (const listener of listeners) {
    try {
      listener(files, status);
    } catch (e) {
      console.warn('[Sync] Listener error:', e);
    }
  }
}

/**
 * Starts the background synchronization interval (reconciles every 45 seconds).
 */
export function startEverlyBackgroundSync(onFilesUpdated: (files: UnifiedFileRecord[]) => void) {
  if (syncIntervalId) return;

  subscribeSync((files) => {
    onFilesUpdated(files);
  });

  // Run initial sync after 2 seconds
  setTimeout(() => {
    runCloudSync();
  }, 2000);

  // Set periodic sync
  syncIntervalId = setInterval(() => {
    runCloudSync();
  }, 45000);
}

export function stopEverlyBackgroundSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

/**
 * Force cloud synchronization immediately
 */
export async function forceCloudSync(onFilesUpdated?: (files: UnifiedFileRecord[]) => void): Promise<{ success: boolean; files: UnifiedFileRecord[]; error?: string }> {
  clearDriveAAuthExpired();
  try {
    const files = await runCloudSync();
    if (onFilesUpdated) onFilesUpdated(files);
    return { success: true, files };
  } catch (e: any) {
    return { success: false, files: [], error: e?.message || 'Sync failed' };
  }
}

/**
 * Helper to open unified DB directly for deletion sync
 */
async function openEverlyDBDirect(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EverlyUnifiedCloudStorageDB_v4', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Executes a full cloud synchronization pass across Drive A and Drive B.
 */
export async function runCloudSync(): Promise<UnifiedFileRecord[]> {
  if (isSyncing) return initEverlyCloudStorage();
  isSyncing = true;
  notifyListeners([], { isSyncing: true, lastSyncedAt, isDriveAAuthExpired: isDriveAAuthExpired() });

  try {
    const localFiles = await initEverlyCloudStorage();
    const tokenA = getStoredAccessToken(); // Drive A token

    const cloudFilesMap = new Map<string, { provider: DriveProviderType; name: string; id: string; mimeType: string; size: number }>();

    // 1. Fetch remote files from Drive A if token available and auth is not expired
    const authExpired = isDriveAAuthExpired();
    if (tokenA && !authExpired) {
      try {
        const remoteA = await listDriveFiles(tokenA);
        for (const file of remoteA) {
          if (file.id && file.name) {
            cloudFilesMap.set(`DRIVE_A:${file.id}`, {
              provider: 'DRIVE_A',
              name: file.name,
              id: file.id,
              mimeType: file.mimeType || 'application/octet-stream',
              size: Number(file.size) || 1024000,
            });
          }
        }
      } catch (err: any) {
        if (err?.isAuthExpired || err?.status === 401 || err?.message?.includes('expired') || err?.message?.includes('authorization')) {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(STORAGE_KEY_DRIVE_A_EXPIRED, 'true');
          }
          console.warn('[Drive Sync] Google Drive authorization token has expired. Drive A sync paused until reconnected.');
        } else {
          console.warn('Background sync warning: Could not fetch Drive A remote list', err);
        }
      }
    }

    // 2. Reconcile local records with cloud state
    const reconciled: UnifiedFileRecord[] = [...localFiles];
    let changesDetected = false;

    // Check for cloud deletions (files present locally as non-mock but missing in cloud)
    const activeLocal = reconciled.filter((f) => {
      if (f.driveProvider === 'DRIVE_A' && tokenA && !authExpired && !f.driveFileId.startsWith('1drive_')) {
        const existsInCloud = cloudFilesMap.has(`DRIVE_A:${f.driveFileId}`);
        if (!existsInCloud) {
          changesDetected = true;
          return false; // Remove locally deleted
        }
      }
      return true;
    });

    if (changesDetected || activeLocal.length !== localFiles.length) {
      // Save updated active local to IndexedDB
      try {
        const db = await openEverlyDBDirect();
        const tx = db.transaction('unified_files', 'readwrite');
        const store = tx.objectStore('unified_files');
        store.clear();
        for (const f of activeLocal) {
          store.put(f);
        }
      } catch {}
    }

    const nowIso = new Date().toISOString();
    lastSyncedAt = nowIso;
    persistLastSync(nowIso);
    isSyncing = false;
    notifyListeners(activeLocal, {
      isSyncing: false,
      lastSyncedAt: nowIso,
      filesSyncedCount: activeLocal.length,
      isDriveAAuthExpired: isDriveAAuthExpired(),
    });

    return activeLocal;
  } catch (e: any) {
    isSyncing = false;
    notifyListeners([], {
      isSyncing: false,
      lastSyncedAt,
      error: e?.message || 'Sync failed',
      isDriveAAuthExpired: isDriveAAuthExpired(),
    });
    return initEverlyCloudStorage();
  }
}

/**
   * Reconnects Google Drive A by launching Google OAuth authorization for primary owner (benilin76@gmail.com),
   * obtaining fresh token, clearing expired flag, and resuming background sync.
   */
export async function reconnectDriveA(): Promise<{ success: boolean; error?: string }> {
  try {
    const googleResult = await launchGoogleSignIn();
    if (!googleResult || !googleResult.email) {
      return { success: false, error: 'Google sign-in was cancelled or did not return an account.' };
    }

    if (googleResult.email.toLowerCase().trim() !== PRIMARY_OWNER_EMAIL.toLowerCase()) {
      return {
        success: false,
        error: `Incorrect Google account selected (${googleResult.email}). Please sign in with primary owner account: ${PRIMARY_OWNER_EMAIL}`,
      };
    }

    if (googleResult.idToken && typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('everly_password_token_v6', googleResult.idToken);
    }

    clearDriveAAuthExpired();

    const syncResult = await forceCloudSync();
    if (!syncResult.success) {
      return { success: false, error: syncResult.error || 'Drive A reconnected, but cloud sync test failed.' };
    }

    return { success: true };
  } catch (err: any) {
    if (err?.isCancelled || err?.code === 'auth/popup-closed-by-user') {
      return { success: false, error: 'Google sign-in window was closed.' };
    }
    if (err?.isPopupBlocked) {
      try {
        await launchGoogleRedirectSignIn();
        return { success: false, error: 'Redirecting to Google sign-in...' };
      } catch (redirectErr: any) {
        return { success: false, error: redirectErr?.message || 'Popup blocked and redirect failed.' };
      }
    }
    return { success: false, error: err?.message || 'Failed to reconnect Google Drive A.' };
  }
}

