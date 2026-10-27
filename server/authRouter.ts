import express, { Request, Response } from 'express';
import * as authStore from './authStore';

// In-memory rate limiter for auth endpoints (20 attempts per minute per IP)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function checkRateLimit(ip: string, limit = 20, windowMs = 60000): boolean {
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
      authProvider: 'password',
      supportedProviders: ['password'],
      googleAuthOnly: false,
      passwordsEnabled: true,
    });
  });

  // Check account status & setup requirement
  router.get('/status', (_req: Request, res: Response) => {
    const store = authStore.loadAuthStore();
    const benilinComplete = store[authStore.BENILIN_EMAIL]?.isSetupComplete || false;
    const shanaComplete = store[authStore.SHANALOVE_EMAIL]?.isSetupComplete || false;

    res.json({
      authProvider: 'password',
      isSetupComplete: benilinComplete && shanaComplete,
      benilinSetupComplete: benilinComplete,
      shanaSetupComplete: shanaComplete,
      passwordsEnabled: true,
    });
  });

  // Secure Password Login
  router.post('/login', (req: Request, res: Response) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`login_${clientIp}`, 20, 60000)) {
      res.status(429).json({ error: 'Too many login attempts. Please wait a moment and try again.' });
      return;
    }

    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Missing or invalid email address.' });
      return;
    }

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Missing password.' });
      return;
    }

    const result = authStore.authenticateUser({
      email: email.trim(),
      password,
    });

    if (!result.success) {
      if (result.needsSetup) {
        res.status(403).json({
          error: 'Password not configured for this account. Please complete initial setup.',
          needsSetup: true,
          email: email.trim(),
        });
        return;
      }
      res.status(401).json({ error: result.error || 'Authentication failed.' });
      return;
    }

    res.json({ success: true, user: result.user });
  });

  // Initial Password Setup / Reset
  router.post('/setup', (req: Request, res: Response) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(`setup_${clientIp}`, 10, 60000)) {
      res.status(429).json({ error: 'Too many setup attempts. Please wait a moment and try again.' });
      return;
    }

    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !authStore.isAuthorizedUserEmail(email)) {
      res.status(400).json({ error: 'Unauthorized email address.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const result = authStore.setupUserPassword({
      email: email.trim(),
      password,
    });

    if (!result.success) {
      console.error('[AuthRouter] Password setup failure for email:', email.trim(), 'Reason:', result.error);
      res.status(400).json({ error: result.error || 'Password setup failed.' });
      return;
    }

    res.json({ success: true, user: result.user });
  });

  router.post('/reset', (req: Request, res: Response) => {
    // Delegates to setup route for authorized password reset
    const { email, password } = req.body;
    if (!email || !authStore.isAuthorizedUserEmail(email)) {
      res.status(403).json({ error: 'Unauthorized email address.' });
      return;
    }
    const result = authStore.setupUserPassword({ email, password });
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Password reset failed.' });
      return;
    }
    res.json({ success: true, user: result.user });
  });

  // Permanently retired public registration
  router.post('/register', (_req: Request, res: Response) => {
    res.status(410).json({
      error: 'Public registration is permanently disabled. Everly is a private couple vault for authorized users only.',
    });
  });

  return router;
}
