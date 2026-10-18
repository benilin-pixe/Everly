import express, { Request, Response } from 'express';
import * as authStore from './authStore';

export function createAuthRouter() {
  const router = express.Router();

  // Check account setup & existence status
  router.post('/status', (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email || !authStore.isAuthorizedOwnerEmail(email)) {
      res.status(400).json({ error: 'Unauthorized or invalid email address.' });
      return;
    }

    const internal = authStore.getOwnerInternalRecord(email);
    if (!internal) {
      res.status(404).json({ error: 'Owner account not found.' });
      return;
    }

    res.json({
      email: internal.email,
      name: internal.name,
      role: internal.role,
      isSetupComplete: internal.isSetupComplete,
      // For developer / test convenience, output setup token in non-production environments
      debugSetupToken: process.env.NODE_ENV !== 'production' ? internal.setupToken : undefined,
    });
  });

  // Initial password setup
  router.post('/setup', (req: Request, res: Response) => {
    const { email, setupToken, password } = req.body;
    if (!email || !setupToken || !password) {
      res.status(400).json({ error: 'Missing required setup parameters.' });
      return;
    }

    const result = authStore.setupOwnerPassword(email, setupToken, password);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Password setup failed.' });
      return;
    }

    const user = authStore.getOwnerRecord(email);
    res.json({ success: true, user });
  });

  // Secure login with email and password
  router.post('/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Missing email or password.' });
      return;
    }

    const result = authStore.verifyOwnerLogin(email, password);
    if (!result.success || !result.user) {
      res.status(401).json({ error: result.error || 'Invalid email or password.' });
      return;
    }

    res.json({ success: true, user: result.user });
  });

  // Password reset / recovery
  router.post('/reset', (req: Request, res: Response) => {
    const { email, setupToken, newPassword } = req.body;
    if (!email || !setupToken || !newPassword) {
      res.status(400).json({ error: 'Missing required reset parameters.' });
      return;
    }

    const result = authStore.resetOwnerPassword(email, setupToken, newPassword);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Password reset failed.' });
      return;
    }

    res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  });

  return router;
}
