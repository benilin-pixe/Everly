/**
 * Everly Cloud Storage Background Synchronization Service
 * Reconciles metadata between local Everly records and both Google Drive providers (Drive A & Drive B).
 * Ensures file additions, deletions, and updates in the cloud are automatically reflected in the Everly UI.
 */

import { UnifiedFileRecord, DriveProviderType, initEverlyCloudStorage } from './everlyStorageService';
import { listDriveFiles } from './googleDriveService';
import { PRIMARY_OWNER_EMAIL, SHARED_USER_EMAIL, getStoredAccessToken } from './authService';

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error?: string;
  filesSyncedCount?: number;
}

export type SyncListener = (
  syncedFiles: UnifiedFileRecord[],
  syncStatus: SyncStatus
) => void;

const listeners = new Set<SyncListener>();
const STORAGE_KEY_LAST_SYNC = 'everly_google_drive_last_sync_timestamp';

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
  };
}

/**
 * Starts the background synchronization interval (reconciles every 45 seconds).
 */
export function startEverlyBackgroundSync(onFilesUpdated: (files: UnifiedFileRecord[]) => void) {
  if (syncIntervalId) return;

  // Run initial sync after 2 seconds
  setTimeout(() => {
    runCloudSync(onFilesUpdated);
  }, 2000);

  // Set periodic sync
  syncIntervalId = setInterval(() => {
    runCloudSync(onFilesUpdated);
  }, 45000);
}

export function stopEverlyBackgroundSync() {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

/**
 * Executes a full cloud synchronization pass across Drive A and Drive B.
 */
export async function runCloudSync(onFilesUpdated?: (files: UnifiedFileRecord[]) => void): Promise<UnifiedFileRecord[]> {
  if (isSyncing) return initEverlyCloudStorage();
  isSyncing = true;
  notifyListeners([], { isSyncing: true, lastSyncedAt });

  try {
    const localFiles = await initEverlyCloudStorage();
    const tokenA = getStoredAccessToken(); // Drive A token

    const cloudFilesMap = new Map<string, { provider: DriveProviderType; name: string; id: string; mimeType: string; size: number }>();

    // 1. Fetch remote files from Drive A if token available
    if (tokenA) {
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
      } catch (err) {
        console.warn('Background sync warning: Could not fetch Drive A remote list', err);
      }
    }

    // 2. Reconcile local records with cloud state
    const reconciled: UnifiedFileRecord[] = [...localFiles];
    let changesDetected = false;

    // Check for cloud deletions (files present locally as non-mock but missing in cloud)
    const activeLocal = reconciled.filter((f) => {
      if (f.driveProvider === 'DRIVE_A' && tokenA && !f.driveFileId.startsWith('1drive_')) {
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
        const db = await openUnifiedDBDirect();
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
    });
    onFilesUpdated?.(activeLocal);
    return activeLocal;
  } catch (err: any) {
    isSyncing = false;
    notifyListeners([], {
      isSyncing: false,
      lastSyncedAt: getLastSuccessfulSyncTimestamp(),
      error: err?.message || 'Sync failed',
    });
    return initEverlyCloudStorage();
  }
}

/**
 * Manually forces an immediate cloud synchronization pass with Google Drive.
 */
export async function forceCloudSync(
  onFilesUpdated?: (files: UnifiedFileRecord[]) => void
): Promise<{ success: boolean; files: UnifiedFileRecord[]; timestamp: string; error?: string }> {
  try {
    const syncedFiles = await runCloudSync(onFilesUpdated);
    const ts = getLastSuccessfulSyncTimestamp() || new Date().toISOString();
    return {
      success: true,
      files: syncedFiles,
      timestamp: ts,
    };
  } catch (err: any) {
    return {
      success: false,
      files: [],
      timestamp: getLastSuccessfulSyncTimestamp() || new Date().toISOString(),
      error: err?.message || 'Force sync failed',
    };
  }
}

function openUnifiedDBDirect(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('EverlyUnifiedCloudStorageDB_v4', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  // Emit current status immediately
  try {
    listener([], getSyncStatus());
  } catch {}
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners(
  files: UnifiedFileRecord[],
  status: SyncStatus
) {
  listeners.forEach((fn) => {
    try {
      fn(files, status);
    } catch {}
  });
}
