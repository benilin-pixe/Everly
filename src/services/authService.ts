import { AuthorizedUser, UserRole } from '../types';
import {
  launchGoogleSignIn,
  launchGoogleRedirectSignIn,
  checkRedirectSignInResult,
  signOutFromGoogle,
  GoogleAuthResult,
} from './firebaseAuth';

export const PRIMARY_OWNER_EMAIL = 'benilin76@gmail.com';
export const SHARED_USER_EMAIL = 'shanalove917@gmail.com';

export const AUTHORIZED_USERS: Record<string, { name: string; role: UserRole; avatarInitials: string; avatarColor: string }> = {
  [PRIMARY_OWNER_EMAIL]: {
    name: 'BeniLin',
    role: 'Owner',
    avatarInitials: 'BL',
    avatarColor: 'from-rose-500 to-amber-600',
  },
  [SHARED_USER_EMAIL]: {
    name: 'Shana Love',
    role: 'Member',
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  },
};

const AUTH_STORAGE_KEY = 'everly_google_user_v5';
const TOKEN_STORAGE_KEY = 'everly_google_access_token_v5';
const ACCESS_DENIED_STORAGE_KEY = 'everly_denied_attempt_v5';

// OAuth Client ID from Google Cloud / Firebase applet config
export const GOOGLE_OAUTH_CLIENT_ID = '370113877663-fgqpe37aca3o8227ieo3cnrs0ve1js1g.apps.googleusercontent.com';

/**
 * Verifies a Google sign-in identity with the backend and returns the Everly profile
 */
export async function authenticateWithGoogleBackend(payload: GoogleAuthResult): Promise<AuthorizedUser> {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleSub: payload.googleSub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      idToken: payload.idToken,
      emailVerified: payload.emailVerified,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errorMsg = err.error || 'This Google account is not authorized to access Everly.';
    recordDeniedAttempt(payload.email || 'Unknown Account');
    const authErr = new Error(errorMsg);
    (authErr as any).attemptedEmail = payload.email;
    throw authErr;
  }

  const data = await res.json();
  const user: AuthorizedUser = {
    email: data.user.email,
    name: data.user.name,
    role: data.user.role,
    avatarInitials: data.user.avatarInitials,
    avatarColor: data.user.avatarColor,
    picture: data.user.avatarUrl,
    googleSub: data.user.googleSub,
    accessToken: payload.accessToken,
  };

  setStoredUser(user, payload.accessToken);
  clearDeniedAttempt();
  return user;
}

/**
 * Checks for a pending redirect sign-in result on page load
 */
export async function handleRedirectAuthIfPresent(): Promise<AuthorizedUser | null> {
  const result = await checkRedirectSignInResult();
  if (result) {
    return await authenticateWithGoogleBackend(result);
  }
  return null;
}

/**
 * Performs full Google sign-in flow via popup:
 * 1. Launches official Google OAuth popup (Firebase Auth)
 * 2. Transmits verified Google identity to backend
 * 3. Saves session and returns authenticated user
 */
export async function signInWithGoogleFlow(): Promise<AuthorizedUser> {
  const googleResult = await launchGoogleSignIn();
  return await authenticateWithGoogleBackend(googleResult);
}

/**
 * Initiates Google OAuth redirect flow
 */
export async function signInWithGoogleRedirectFlow(): Promise<void> {
  await launchGoogleRedirectSignIn();
}

export const isEmailAuthorized = (email: string): boolean => {
  if (!email || !email.includes('@')) return false;
  const lower = email.toLowerCase().trim();
  return lower === PRIMARY_OWNER_EMAIL || lower === SHARED_USER_EMAIL;
};

export const getUserRole = (email: string): UserRole => {
  if (!email) return 'Member';
  const normalized = email.trim().toLowerCase();
  if (normalized === PRIMARY_OWNER_EMAIL) return 'Owner';
  if (normalized === SHARED_USER_EMAIL) return 'Member';
  return 'Member';
};

export const getStoredUser = (): AuthorizedUser | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && isEmailAuthorized(parsed.email)) {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      return {
        ...parsed,
        accessToken: token || parsed.accessToken,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const getStoredAccessToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: AuthorizedUser | null, accessToken?: string) => {
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    if (accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
    }
    localStorage.removeItem(ACCESS_DENIED_STORAGE_KEY);
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
};

export const recordDeniedAttempt = (attemptedEmail: string) => {
  localStorage.setItem(
    ACCESS_DENIED_STORAGE_KEY,
    JSON.stringify({
      email: attemptedEmail,
      timestamp: new Date().toISOString(),
      message: 'This Google account is not authorized to access Everly.',
    })
  );
};

export const getDeniedAttempt = (): { email: string; timestamp: string; message: string } | null => {
  try {
    const raw = localStorage.getItem(ACCESS_DENIED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearDeniedAttempt = () => {
  localStorage.removeItem(ACCESS_DENIED_STORAGE_KEY);
};

export async function signOutEverly(): Promise<void> {
  await signOutFromGoogle();
  setStoredUser(null);
  clearDeniedAttempt();
}

/**
 * Access Control Permission Helpers
 */
export const canManageSettings = (user: AuthorizedUser | null): boolean => {
  if (!user) return false;
  return user.role === 'Owner' || user.email.toLowerCase() === PRIMARY_OWNER_EMAIL;
};

export const canDeleteFile = (user: AuthorizedUser | null, fileAuthorEmail: string): boolean => {
  if (!user) return false;
  if (user.role === 'Owner') return true;
  return user.email.toLowerCase() === fileAuthorEmail.toLowerCase();
};

export const canUpload = (user: AuthorizedUser | null): boolean => {
  return Boolean(user && user.email && isEmailAuthorized(user.email));
};
