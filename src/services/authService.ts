import { AuthorizedUser, UserRole } from '../types';

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
    role: 'Owner',
    avatarInitials: 'SL',
    avatarColor: 'from-pink-500 to-rose-600',
  },
};

const AUTH_STORAGE_KEY = 'everly_authorized_user_v3';
const TOKEN_STORAGE_KEY = 'everly_google_access_token_v3';
const ACCESS_DENIED_STORAGE_KEY = 'everly_denied_attempt_v3';

// Backend Authentication API calls
export async function checkAccountSetupStatus(email: string): Promise<{ isSetupComplete: boolean; debugSetupToken?: string }> {
  try {
    const res = await fetch('/api/auth/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to check setup status.');
    }
    return await res.json();
  } catch (err: any) {
    throw err;
  }
}

export async function setupOwnerPasswordApi(email: string, setupToken: string, password: string): Promise<AuthorizedUser> {
  const res = await fetch('/api/auth/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, setupToken, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Password setup failed.');
  }
  const data = await res.json();
  return data.user;
}

export async function loginWithPasswordApi(email: string, password: string): Promise<AuthorizedUser> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Invalid email or password.');
  }
  const data = await res.json();
  return data.user;
}

export async function resetOwnerPasswordApi(email: string, setupToken: string, newPassword: string): Promise<void> {
  const res = await fetch('/api/auth/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, setupToken, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Password reset failed.');
  }
}

// OAuth Client ID from Google Cloud / Firebase applet config
export const GOOGLE_OAUTH_CLIENT_ID = '370113877663-fgqpe37aca3o8227ieo3cnrs0ve1js1g.apps.googleusercontent.com';

export const isEmailAuthorized = (email: string): boolean => {
  const normalized = email.trim().toLowerCase();
  return Boolean(AUTHORIZED_USERS[normalized]);
};

export const getUserRole = (email: string): UserRole | null => {
  const normalized = email.trim().toLowerCase();
  return AUTHORIZED_USERS[normalized]?.role || null;
};

export const getStoredUser = (): AuthorizedUser | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.email && isEmailAuthorized(parsed.email)) {
      const normalized = parsed.email.trim().toLowerCase();
      const defaultInfo = AUTHORIZED_USERS[normalized] || {};
      // Re-attach access token if available
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      return {
        ...defaultInfo,
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
      message: 'Your Google account is not authorized to access Everly.',
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
  return Boolean(user && isEmailAuthorized(user.email));
};

/**
 * Initiates Google OAuth 2.0 via Google Identity Services Token Client
 */
export async function authenticateWithGoogle(): Promise<AuthorizedUser> {
  return new Promise((resolve, reject) => {
    // Check if google client script is ready
    const google = (window as any).google;
    if (!google || !google.accounts || !google.accounts.oauth2) {
      reject(new Error('Google Identity Services is initializing. Please try again in a moment.'));
      return;
    }

    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile openid',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }

          const accessToken = tokenResponse.access_token;
          if (!accessToken) {
            reject(new Error('No access token received from Google.'));
            return;
          }

          try {
            // Fetch Google User Profile
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!userInfoRes.ok) {
              throw new Error('Failed to retrieve user profile from Google.');
            }

            const profile = await userInfoRes.json();
            const email = (profile.email || '').trim().toLowerCase();

            // Authorization Gate
            if (!isEmailAuthorized(email)) {
              recordDeniedAttempt(email);
              reject(new Error('Your Google account is not authorized to access Everly.'));
              return;
            }

            const info = AUTHORIZED_USERS[email];
            const authorizedUser: AuthorizedUser = {
              email,
              name: profile.name || info.name,
              role: info.role,
              avatarInitials: info.avatarInitials,
              avatarColor: info.avatarColor,
              picture: profile.picture,
              accessToken,
            };

            setStoredUser(authorizedUser, accessToken);
            resolve(authorizedUser);
          } catch (fetchErr: any) {
            reject(fetchErr);
          }
        },
      });

      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
}
