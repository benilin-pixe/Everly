import express, { Request, Response } from 'express';
import * as authStore from './authStore';

// In-memory rate limiter for auth endpoints (25 attempts per minute per IP)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string, limit = 25, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count += 1;
  return true;
}

export function createAuthRouter() {
  const router = express.Router();

  // Authentication configuration and provider status
  router.get('/config', (_req: Request, res: Response) => {
    res.json({
      authProvider: 'google',
      supportedProviders: ['google'],
      googleAuthOnly: true,
      passwordsEnabled: false,
    });
  });

  // Verify and authenticate Google identity
  router.post('/google', (req: Request, res: Response) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`google_auth_${clientIp}`, 30, 60000)) {
      res.status(429).json({ error: 'Too many authentication attempts. Please wait a moment and try again.' });
      return;
    }

    const { googleSub, email, name, avatarUrl } = req.body;

    if (!googleSub || typeof googleSub !== 'string' || googleSub.trim().length === 0) {
      res.status(400).json({ error: 'Missing or invalid Google subject identifier (googleSub).' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Missing or invalid verified Google email.' });
      return;
    }

    const result = authStore.authenticateWithGoogle({
      googleSub: googleSub.trim(),
      email: email.trim(),
      name,
      avatarUrl,
      emailVerified: req.body.emailVerified,
    });

    if (!result.success || !result.user) {
      res.status(403).json({ error: result.error || 'This Google account is not authorized to access Everly.' });
      return;
    }

    res.json({ success: true, user: result.user });
  });

  // Retrieve existing authenticated Google profile
  router.get('/profile/:googleSub', (req: Request, res: Response) => {
    const { googleSub } = req.params;
    if (!googleSub) {
      res.status(400).json({ error: 'Missing googleSub parameter.' });
      return;
    }

    const profile = authStore.getGoogleProfileBySub(googleSub);
    if (!profile) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    res.json({ success: true, user: profile });
  });

  // Retired legacy password and public registration routes
  const retiredAuthHandler = (_req: Request, res: Response) => {
    res.status(410).json({
      error: 'Everly has transitioned to Google Sign-In only. Passwords and separate account creation have been permanently retired.',
    });
  };

  router.post('/register', retiredAuthHandler);
  router.post('/login', retiredAuthHandler);
  router.post('/setup', retiredAuthHandler);
  router.post('/reset', retiredAuthHandler);
  router.post('/status', (_req: Request, res: Response) => {
    res.json({
      authProvider: 'google',
      isSetupComplete: true,
      passwordsEnabled: false,
    });
  });

  return router;
}
