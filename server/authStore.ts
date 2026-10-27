import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const AUTH_FILE = path.join(DATA_DIR, 'owner_auth.json');

export const BENILIN_EMAIL = 'benilin76@gmail.com';
export const SHANALOVE_EMAIL = 'shanalove917@gmail.com';

export const AUTHORIZED_USERS: Record<
  string,
  {
    role: 'Owner' | 'Member';
    name: string;
    avatarInitials: string;
    avatarColor: string;
  }
> = {
  [BENILIN_EMAIL]: {
    role: 'Owner',
    name: 'BeniLin',
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
  },
  [SHANALOVE_EMAIL]: {
    role: 'Owner',
    name: 'Shana Love',
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  },
};

export interface OwnerAuthRecord {
  email: string;
  name: string;
  role: 'Owner' | 'Member';
  isSetupComplete: boolean;
  avatarInitials: string;
  avatarColor: string;
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: string;
  lastLoginAt?: string;
}

const DEFAULT_AUTH_STATE: Record<string, OwnerAuthRecord> = {
  [BENILIN_EMAIL]: {
    email: BENILIN_EMAIL,
    name: 'BeniLin',
    role: 'Owner',
    isSetupComplete: false,
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
    createdAt: new Date().toISOString(),
  },
  [SHANALOVE_EMAIL]: {
    email: SHANALOVE_EMAIL,
    name: 'Shana Love',
    role: 'Owner',
    isSetupComplete: false,
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
    createdAt: new Date().toISOString(),
  },
};

let authCache: Record<string, OwnerAuthRecord> | null = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadAuthStore(): Record<string, OwnerAuthRecord> {
  if (authCache) return authCache;
  ensureDataDir();

  if (fs.existsSync(AUTH_FILE)) {
    try {
      const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const loaded: Record<string, OwnerAuthRecord> = { ...DEFAULT_AUTH_STATE, ...parsed };
      if (loaded[BENILIN_EMAIL]) loaded[BENILIN_EMAIL].role = 'Owner';
      if (loaded[SHANALOVE_EMAIL]) loaded[SHANALOVE_EMAIL].role = 'Owner';
      authCache = loaded;
      return authCache;
    } catch (e) {
      console.error('[AuthStore] Error loading auth file:', e);
    }
  }

  authCache = JSON.parse(JSON.stringify(DEFAULT_AUTH_STATE));
  saveAuthStore();
  return authCache!;
}

function saveAuthStore() {
  if (!authCache) return;
  try {
    ensureDataDir();
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

export function isAuthorizedUserEmail(email?: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return lower === BENILIN_EMAIL || lower === SHANALOVE_EMAIL;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
  } catch {
    return false;
  }
}

export function authenticateUser(payload: {
  email: string;
  password?: string;
}): { success: boolean; user?: OwnerAuthRecord; error?: string; needsSetup?: boolean } {
  const { email, password } = payload;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { success: false, error: 'Invalid email address.' };
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!isAuthorizedUserEmail(cleanEmail)) {
    return { success: false, error: 'This email address is not authorized to access Everly.' };
  }

  const store = loadAuthStore();
  let record = store[cleanEmail];

  if (!record) {
    const meta = AUTHORIZED_USERS[cleanEmail];
    record = {
      email: cleanEmail,
      name: meta.name,
      role: meta.role,
      isSetupComplete: false,
      avatarInitials: meta.avatarInitials,
      avatarColor: meta.avatarColor,
      createdAt: new Date().toISOString(),
    };
    store[cleanEmail] = record;
    saveAuthStore();
  }

  // If password is not yet configured, signal that setup is needed
  if (!record.isSetupComplete || !record.passwordHash || !record.passwordSalt) {
    return { success: false, error: 'Password not configured. Please complete initial account setup.', needsSetup: true };
  }

  if (!password || typeof password !== 'string') {
    return { success: false, error: 'Password is required.' };
  }

  const isValid = verifyPassword(password, record.passwordHash, record.passwordSalt);
  if (!isValid) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  record.lastLoginAt = new Date().toISOString();
  saveAuthStore();

  return { success: true, user: record };
}

export function setupUserPassword(payload: {
  email: string;
  password: string;
  setupToken?: string;
}): { success: boolean; error?: string; user?: OwnerAuthRecord } {
  const { email, password } = payload;

  if (!email || !isAuthorizedUserEmail(email)) {
    return { success: false, error: 'Unauthorized email address. Only benilin76@gmail.com and shanalove917@gmail.com are permitted.' };
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const cleanEmail = email.toLowerCase().trim();
  try {
    const store = loadAuthStore();
    let record = store[cleanEmail];

    if (!record) {
      const meta = AUTHORIZED_USERS[cleanEmail];
      record = {
        email: cleanEmail,
        name: meta?.name || 'Owner',
        role: meta?.role || 'Owner',
        isSetupComplete: false,
        avatarInitials: meta?.avatarInitials || 'EV',
        avatarColor: meta?.avatarColor || 'from-rose-500 to-amber-600',
        createdAt: new Date().toISOString(),
      };
    }

    const { hash, salt } = hashPassword(password);
    record.passwordHash = hash;
    record.passwordSalt = salt;
    record.isSetupComplete = true;
    record.lastLoginAt = new Date().toISOString();

    store[cleanEmail] = record;
    saveAuthStore();

    return { success: true, user: record };
  } catch (err: any) {
    console.error('[AuthStore] setupUserPassword error:', err?.message || err);
    return { success: false, error: err?.message || 'Password setup failed due to an internal server error.' };
  }
}
