import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const AUTH_FILE = path.join(DATA_DIR, 'owner_auth.json');
const GOOGLE_USERS_FILE = path.join(DATA_DIR, 'google_users.json');

export const BENILIN_EMAIL = 'benilin76@gmail.com';
export const SHANALOVE_EMAIL = 'shanalove917@gmail.com';

// Access Policy: Only benilin76 (OWNER) and shanalove917 (MEMBER) are authorized
export const AUTHORIZED_GOOGLE_ACCOUNTS: Record<
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
    role: 'Member',
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
  linkedGoogleSub?: string;
  googleLinkedAt?: string;
}

export interface GoogleAuthProfile {
  id: string;
  googleSub: string;
  email: string;
  name: string;
  role: 'Owner' | 'Member';
  avatarInitials: string;
  avatarColor: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt: string;
  linkedOwnerEmail?: string;
}

const DEFAULT_AUTH_STATE: Record<string, OwnerAuthRecord> = {
  [BENILIN_EMAIL]: {
    email: BENILIN_EMAIL,
    name: 'BeniLin',
    role: 'Owner',
    isSetupComplete: true,
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
  },
  [SHANALOVE_EMAIL]: {
    email: SHANALOVE_EMAIL,
    name: 'Shana Love',
    role: 'Member',
    isSetupComplete: true,
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  },
};

let authCache: Record<string, OwnerAuthRecord> | null = null;
let googleUsersCache: Record<string, GoogleAuthProfile> | null = null;

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
      authCache = { ...DEFAULT_AUTH_STATE, ...parsed };
      return authCache!;
    } catch (e) {
      console.error('[AuthStore] Error loading auth file:', e);
    }
  }

  authCache = { ...DEFAULT_AUTH_STATE };
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

export function loadGoogleUsers(): Record<string, GoogleAuthProfile> {
  if (googleUsersCache) return googleUsersCache;
  ensureDataDir();

  if (fs.existsSync(GOOGLE_USERS_FILE)) {
    try {
      const raw = fs.readFileSync(GOOGLE_USERS_FILE, 'utf-8');
      googleUsersCache = JSON.parse(raw);
      return googleUsersCache!;
    } catch (e) {
      console.error('[AuthStore] Error loading Google users file:', e);
    }
  }

  googleUsersCache = {};
  saveGoogleUsers();
  return googleUsersCache!;
}

function saveGoogleUsers() {
  if (!googleUsersCache) return;
  try {
    ensureDataDir();
    fs.writeFileSync(GOOGLE_USERS_FILE, JSON.stringify(googleUsersCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AuthStore] Error saving Google users store:', err);
  }
}

export function isAuthorizedOwnerEmail(email?: string): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === BENILIN_EMAIL;
}

export function isAuthorizedUserEmail(email?: string): boolean {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return lower === BENILIN_EMAIL || lower === SHANALOVE_EMAIL;
}

export function getOwnerRecord(email: string): OwnerAuthRecord | null {
  if (!isAuthorizedUserEmail(email)) return null;
  const store = loadAuthStore();
  return store[email.toLowerCase().trim()] || null;
}

/**
 * Verifies and authenticates a user using their verified Google identity.
 * Step 3 Access Policy:
 * - Only benilin76@gmail.com (OWNER) and shanalove917@gmail.com (MEMBER) are authorized.
 * - All other accounts are strictly rejected with:
 *   "This Google account is not authorized to access Everly."
 * - Verified email requirement enforced.
 * - Role is strictly server-authoritative (never granted from client data).
 */
export function authenticateWithGoogle(payload: {
  googleSub: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}): { success: boolean; user?: GoogleAuthProfile; error?: string } {
  const { googleSub, email, name, avatarUrl, emailVerified } = payload;

  if (!googleSub || typeof googleSub !== 'string' || googleSub.trim().length === 0) {
    return { success: false, error: 'Missing verified Google subject identifier.' };
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return { success: false, error: 'This Google account is not authorized to access Everly.' };
  }

  if (emailVerified === false) {
    return { success: false, error: 'This Google account is not authorized to access Everly.' };
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanSub = googleSub.trim();

  // Strict Policy Check: Reject any account other than benilin76@gmail.com or shanalove917@gmail.com
  const authorizedAccount = AUTHORIZED_GOOGLE_ACCOUNTS[cleanEmail];
  if (!authorizedAccount) {
    return {
      success: false,
      error: 'This Google account is not authorized to access Everly.',
    };
  }

  // Server-authoritative role: OWNER for benilin76, MEMBER for shanalove917
  const role: 'Owner' | 'Member' = authorizedAccount.role;
  const displayName = name?.trim() || authorizedAccount.name;

  const googleStore = loadGoogleUsers();
  const now = new Date().toISOString();

  // 1. Lookup existing profile by stable Google subject identifier
  let profile = googleStore[cleanSub];

  if (profile) {
    profile.lastLoginAt = now;
    profile.role = role;
    profile.email = cleanEmail;
    if (displayName) profile.name = displayName;
    if (avatarUrl) profile.avatarUrl = avatarUrl;
    saveGoogleUsers();
    return { success: true, user: profile };
  }

  // 2. Create new profile for authorized Google account
  profile = {
    id: `ev_${cleanSub.slice(-8)}_${Date.now().toString(36)}`,
    googleSub: cleanSub,
    email: cleanEmail,
    name: displayName,
    role,
    avatarInitials: authorizedAccount.avatarInitials,
    avatarColor: authorizedAccount.avatarColor,
    avatarUrl,
    createdAt: now,
    lastLoginAt: now,
    linkedOwnerEmail: cleanEmail,
  };

  googleStore[cleanSub] = profile;
  saveGoogleUsers();

  // Link to existing store record
  const ownerStore = loadAuthStore();
  if (ownerStore[cleanEmail]) {
    ownerStore[cleanEmail].linkedGoogleSub = cleanSub;
    ownerStore[cleanEmail].googleLinkedAt = now;
    ownerStore[cleanEmail].role = role;
    ownerStore[cleanEmail].isSetupComplete = true;
    saveAuthStore();
  }

  return { success: true, user: profile };
}

export function getGoogleProfileBySub(googleSub: string): GoogleAuthProfile | null {
  if (!googleSub) return null;
  const store = loadGoogleUsers();
  const profile = store[googleSub.trim()];
  if (!profile) return null;

  // Enforce access policy
  if (!isAuthorizedUserEmail(profile.email)) {
    return null;
  }

  return profile;
}
