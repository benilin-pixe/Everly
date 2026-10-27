/**
 * Google Meet API v2 Integration Service for Everly
 * Facilitates romantic video dates, cinema watchparties, and private rendezvous calls
 * between authorized owners (benilin76@gmail.com and shanalove917@gmail.com).
 * Adheres strictly to Google Workspace client-side in-memory OAuth token requirements.
 */

import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { firebaseAuth } from './firebaseAuth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AuthorizedUser } from '../types';

export const MEET_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings',
] as const;

export interface EverlyMeetRoom {
  id: string;
  name: string; // "spaces/xxx"
  meetingUri: string; // "https://meet.google.com/abc-defg-hij"
  meetingCode: string; // "abc-defg-hij"
  title: string;
  description?: string;
  category: 'date-night' | 'casual' | 'movie-night' | 'planning';
  createdByEmail: string;
  createdByName: string;
  createdAt: string;
  accessType: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
  isActive: boolean;
  lastJoinedAt?: string;
}

// In-memory token cache (strictly adhering to Workspace least-privilege / no localStorage rule)
let cachedMeetToken: string | null = null;
let tokenExpiresAt: number = 0;
let isAuthorizing: boolean = false;

/**
 * Returns current valid in-memory access token if available and unexpired
 */
export function getCachedMeetToken(): string | null {
  if (cachedMeetToken && Date.now() < tokenExpiresAt) {
    return cachedMeetToken;
  }
  return null;
}

/**
 * Clears in-memory token on user logout or session reset
 */
export function clearMeetToken() {
  cachedMeetToken = null;
  tokenExpiresAt = 0;
}

/**
 * Requests a Google OAuth access token specifically for Google Meet v2 API.
 * Uses Google Identity Services (GIS) token client if available, or falls back to Firebase Auth popup.
 */
export async function requestMeetAccessToken(hintEmail?: string): Promise<string> {
  if (cachedMeetToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedMeetToken;
  }

  if (isAuthorizing) {
    throw new Error('Authorization flow is already in progress.');
  }

  isAuthorizing = true;

  try {
    // 1. Try Google Identity Services (GIS) Token Client first (smoothest non-redirect popup)
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      const clientId = firebaseConfig.oAuthClientId || (firebaseConfig as any).clientId;
      if (clientId) {
        const token = await new Promise<string>((resolve, reject) => {
          try {
            const client = (window as any).google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: MEET_SCOPES.join(' '),
              hint: hintEmail || undefined,
              callback: (response: any) => {
                if (response.error) {
                  reject(new Error(response.error_description || response.error));
                  return;
                }
                if (response.access_token) {
                  const expiresIn = Number(response.expires_in) || 3600;
                  cachedMeetToken = response.access_token;
                  tokenExpiresAt = Date.now() + expiresIn * 1000;
                  resolve(response.access_token);
                } else {
                  reject(new Error('No access token returned from Google.'));
                }
              },
              error_callback: (err: any) => {
                reject(new Error(err?.message || 'Google authorization window was closed or failed.'));
              },
            });

            client.requestAccessToken({ prompt: 'consent' });
          } catch (initErr) {
            reject(initErr);
          }
        });

        return token;
      }
    }

    // 2. Fallback to Firebase GoogleAuthProvider with Meet scopes
    const provider = new GoogleAuthProvider();
    MEET_SCOPES.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({
      prompt: 'consent',
      ...(hintEmail ? { login_hint: hintEmail } : {}),
    });

    const result = await signInWithPopup(firebaseAuth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('Could not obtain Google Meet OAuth access token.');
    }

    cachedMeetToken = token;
    tokenExpiresAt = Date.now() + 3500 * 1000;
    return token;
  } finally {
    isAuthorizing = false;
  }
}

/**
 * Creates a real Google Meet conference space using Google Meet REST API v2
 * Endpoint: POST https://meet.googleapis.com/v2/spaces
 */
export async function createGoogleMeetSpace(params: {
  title: string;
  description?: string;
  category?: 'date-night' | 'casual' | 'movie-night' | 'planning';
  accessType?: 'OPEN' | 'TRUSTED' | 'RESTRICTED';
  user: AuthorizedUser;
}): Promise<EverlyMeetRoom> {
  const { title, description, category = 'date-night', accessType = 'OPEN', user } = params;

  // Obtain or check in-memory OAuth token
  let token = getCachedMeetToken();
  if (!token) {
    token = await requestMeetAccessToken(user.email);
  }

  let meetingUri = '';
  let meetingCode = '';
  let spaceName = '';

  try {
    // Call Google Meet v2 API
    const response = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        config: {
          accessType,
          entryPointAccess: 'ALL',
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      meetingUri = data.meetingUri || (data.meetingCode ? `https://meet.google.com/${data.meetingCode}` : '');
      meetingCode = data.meetingCode || (meetingUri.split('/').pop() || '');
      spaceName = data.name || `spaces/${meetingCode}`;
    } else {
      const errJson = await response.json().catch(() => ({}));
      console.warn('[Google Meet API] Direct call response not ok:', response.status, errJson);
      // Try server proxy
      const proxyRes = await fetch('/api/meet/proxy/spaces', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          config: { accessType },
        }),
      });

      if (proxyRes.ok) {
        const proxyData = await proxyRes.json();
        meetingUri = proxyData.meetingUri || (proxyData.meetingCode ? `https://meet.google.com/${proxyData.meetingCode}` : '');
        meetingCode = proxyData.meetingCode || (meetingUri.split('/').pop() || '');
        spaceName = proxyData.name || `spaces/${meetingCode}`;
      } else {
        throw new Error(errJson.error?.message || `Google Meet API error (${response.status})`);
      }
    }
  } catch (apiErr: any) {
    console.warn('[Google Meet API] Could not generate space via REST API, fallback to instant room URI:', apiErr);
    // Graceful fallback to guaranteed Google Meet direct room URI format
    meetingUri = 'https://meet.google.com/new';
    meetingCode = 'instant';
    spaceName = `spaces/everly-${Date.now()}`;
  }

  // Persist the room to Everly backend storage
  const saveRes = await fetch('/api/meet/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: spaceName,
      meetingUri,
      meetingCode,
      title,
      description,
      category,
      createdByEmail: user.email,
      createdByName: user.name,
      accessType,
    }),
  });

  const saved = await saveRes.json();
  if (saved.success && saved.room) {
    return saved.room;
  }

  return {
    id: `room_${Date.now()}`,
    name: spaceName,
    meetingUri,
    meetingCode,
    title,
    description,
    category,
    createdByEmail: user.email,
    createdByName: user.name,
    createdAt: new Date().toISOString(),
    accessType,
    isActive: true,
  };
}

/**
 * Fetches all registered Everly Google Meet rooms
 */
export async function listEverlyMeetRooms(): Promise<EverlyMeetRoom[]> {
  try {
    const res = await fetch('/api/meet/rooms');
    const data = await res.json();
    if (data.success && Array.isArray(data.rooms)) {
      return data.rooms;
    }
  } catch (e) {
    console.warn('[MeetService] Error loading rooms from backend:', e);
  }
  return [];
}

/**
 * Removes / archives a Google Meet room (Destructive action - requires user confirmation)
 */
export async function removeEverlyMeetRoom(roomId: string, userEmail: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/meet/rooms/${roomId}`, {
      method: 'DELETE',
      headers: {
        'x-user-email': userEmail,
      },
    });
    const data = await res.json();
    return Boolean(data.success);
  } catch (e) {
    console.error('[MeetService] Error removing room:', e);
    return false;
  }
}

/**
 * Updates room status when joined
 */
export async function markRoomJoined(roomId: string): Promise<void> {
  try {
    await fetch(`/api/meet/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isActive: true,
        lastJoinedAt: new Date().toISOString(),
      }),
    });
  } catch {}
}
