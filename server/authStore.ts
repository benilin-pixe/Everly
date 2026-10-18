import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const AUTH_FILE = path.join(DATA_DIR, 'owner_auth.json');

export const BENILIN_EMAIL = 'benilin76@gmail.com';
export const SHANALOVE_EMAIL = 'shanalove917@gmail.com';

export interface OwnerAuthRecord {
  email: string;
  name: string;
  role: 'Owner';
  passwordHash?: string;
  passwordSalt?: string;
  isSetupComplete: boolean;
  setupToken: string;
  avatarInitials: string;
  avatarColor: string;
}

const DEFAULT_AUTH_STATE: Record<string, OwnerAuthRecord> = {
  [BENILIN_EMAIL]: {
    email: BENILIN_EMAIL,
    name: 'BeniLin',
    role: 'Owner',
    isSetupComplete: false,
    setupToken: 'beni-setup-token-2026-secure',
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
  },
  [SHANALOVE_EMAIL]: {
    email: SHANALOVE_EMAIL,
    name: 'Shana Love',
    role: 'Owner',
    isSetupComplete: false,
    setupToken: 'shana-setup-token-2026-secure',
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  },
};

let authCache: Record<string, OwnerAuthRecord> | null = null;

function loadAuthStore(): Record<string, OwnerAuthRecord> {
  if (authCache) return authCache;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(AUTH_FILE)) {
    try {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      authCache = { ...DEFAULT_AUTH_STATE, ...parsed };
      return authCache!;
    } catch (e) {
      console.error('[AuthStore] Error loading auth file, resetting:', e);
    }
  }

  authCache = { ...DEFAULT_AUTH_STATE };
  saveAuthStore();
  return authCache!;
}

function saveAuthStore() {
  if (!authCache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AuthStore] Error saving auth store:', err);
  }
}

export function isAuthorizedOwnerEmail(email?: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return lower === BENILIN_EMAIL || lower === SHANALOVE_EMAIL;
}

export function getOwnerRecord(email: string): OwnerAuthRecord | null {
  if (!isAuthorizedOwnerEmail(email)) return null;
  const store = loadAuthStore();
  const record = store[email.toLowerCase().trim()];
  if (!record) return null;
  // Never expose password hash or setup token in return object
  const { passwordHash, passwordSalt, setupToken, ...safe } = record;
  return {
    ...safe,
    passwordHash: undefined,
    passwordSalt: undefined,
    setupToken: undefined,
  } as any;
}

export function getOwnerInternalRecord(email: string): OwnerAuthRecord | null {
  if (!isAuthorizedOwnerEmail(email)) return null;
  const store = loadAuthStore();
  return store[email.toLowerCase().trim()] || null;
}

export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

export function setupOwnerPassword(email: string, setupToken: string, password: string): { success: boolean; error?: string } {
  if (!isAuthorizedOwnerEmail(email)) {
    return { success: false, error: 'Unauthorized owner account.' };
  }

  const store = loadAuthStore();
  const record = store[email.toLowerCase().trim()];

  if (!record) {
    return { success: false, error: 'Account record not found.' };
  }

  if (record.isSetupComplete) {
    return { success: false, error: 'Account setup is already completed. Please log in normally.' };
  }

  if (record.setupToken !== setupToken.trim()) {
    return { success: false, error: 'Invalid or expired setup invitation token.' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  record.passwordHash = passwordHash;
  record.passwordSalt = salt;
  record.isSetupComplete = true;
  // Invalidate setup token after successful use
  record.setupToken = 'consumed_' + crypto.randomBytes(8).toString('hex');

  saveAuthStore();
  return { success: true };
}

export function verifyOwnerLogin(email: string, password: string): { success: boolean; user?: OwnerAuthRecord; error?: string } {
  if (!isAuthorizedOwnerEmail(email)) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const store = loadAuthStore();
  const record = store[email.toLowerCase().trim()];

  if (!record || !record.isSetupComplete || !record.passwordHash || !record.passwordSalt) {
    return { success: false, error: 'Account password has not been set up yet. Please complete initial setup.' };
  }

  const testHash = hashPassword(password, record.passwordSalt);
  if (testHash !== record.passwordHash) {
    return { success: false, error: 'Invalid email or password.' };
  }

  const { passwordHash, passwordSalt, setupToken, ...safe } = record;
  return { success: true, user: safe as OwnerAuthRecord };
}

export function resetOwnerPassword(email: string, setupToken: string, newPassword: string): { success: boolean; error?: string } {
  if (!isAuthorizedOwnerEmail(email)) {
    return { success: false, error: 'Unauthorized owner account.' };
  }

  const store = loadAuthStore();
  const record = store[email.toLowerCase().trim()];

  if (!record) {
    return { success: false, error: 'Account not found.' };
  }

  if (record.setupToken !== setupToken.trim()) {
    return { success: false, error: 'Invalid security recovery token.' };
  }

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(newPassword, salt);

  record.passwordHash = passwordHash;
  record.passwordSalt = salt;
  record.isSetupComplete = true;
  record.setupToken = 'consumed_' + crypto.randomBytes(8).toString('hex');

  saveAuthStore();
  return { success: true };
}
