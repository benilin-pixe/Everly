import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isAuthorizedOwnerEmail } from './authStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const MEET_FILE = path.join(DATA_DIR, 'meet_rooms.json');

export interface MeetRoomRecord {
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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadMeetRooms(): MeetRoomRecord[] {
  ensureDataDir();
  if (fs.existsSync(MEET_FILE)) {
    try {
      const raw = fs.readFileSync(MEET_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (e) {
      console.error('[MeetRouter] Error loading meet rooms:', e);
    }
  }
  // Default romantic starter rooms for Beni & Shana
  const defaultRooms: MeetRoomRecord[] = [
    {
      id: 'default-date-night',
      name: 'spaces/everly-date-night',
      meetingUri: 'https://meet.google.com/new',
      meetingCode: 'new',
      title: 'Romantic Date Night',
      description: 'Our private candlelit video rendezvous & wine night.',
      category: 'date-night',
      createdByEmail: 'benilin76@gmail.com',
      createdByName: 'BeniLin',
      createdAt: new Date().toISOString(),
      accessType: 'OPEN',
      isActive: true,
    },
    {
      id: 'default-movie-sync',
      name: 'spaces/everly-cinema-sync',
      meetingUri: 'https://meet.google.com/new',
      meetingCode: 'new',
      title: 'Cinema & Movie Sync',
      description: 'Synchronized cinema watchparty and live reactions.',
      category: 'movie-night',
      createdByEmail: 'shanalove917@gmail.com',
      createdByName: 'Shana Love',
      createdAt: new Date().toISOString(),
      accessType: 'OPEN',
      isActive: true,
    },
  ];
  saveMeetRooms(defaultRooms);
  return defaultRooms;
}

function saveMeetRooms(rooms: MeetRoomRecord[]) {
  ensureDataDir();
  fs.writeFileSync(MEET_FILE, JSON.stringify(rooms, null, 2), 'utf-8');
}

export function createMeetRouter() {
  const router = express.Router();

  // List all Meet rooms
  router.get('/rooms', (_req: Request, res: Response) => {
    const rooms = loadMeetRooms();
    res.json({ success: true, rooms });
  });

  // Save / register a created Meet space
  router.post('/rooms', (req: Request, res: Response) => {
    const {
      id,
      name,
      meetingUri,
      meetingCode,
      title,
      description,
      category = 'date-night',
      createdByEmail,
      createdByName,
      accessType = 'OPEN',
    } = req.body;

    if (!meetingUri || !createdByEmail) {
      res.status(400).json({ error: 'Missing required meeting details (meetingUri, createdByEmail).' });
      return;
    }

    if (!isAuthorizedOwnerEmail(createdByEmail)) {
      res.status(403).json({ error: 'Only authorized owners can create Google Meet spaces.' });
      return;
    }

    const rooms = loadMeetRooms();
    const newRoom: MeetRoomRecord = {
      id: id || `meet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name || `spaces/${meetingCode || 'everly'}`,
      meetingUri,
      meetingCode: meetingCode || (meetingUri.split('/').pop() || 'meet'),
      title: title || 'Everly Rendezvous',
      description: description || '',
      category,
      createdByEmail,
      createdByName: createdByName || (createdByEmail.includes('benilin') ? 'BeniLin' : 'Shana Love'),
      createdAt: new Date().toISOString(),
      accessType,
      isActive: true,
      lastJoinedAt: new Date().toISOString(),
    };

    // Prepend new room to the list
    const updated = [newRoom, ...rooms.filter((r) => r.id !== newRoom.id && r.meetingUri !== newRoom.meetingUri)];
    saveMeetRooms(updated);

    res.json({ success: true, room: newRoom });
  });

  // Update room active status / mark as joined
  router.patch('/rooms/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { isActive, lastJoinedAt } = req.body;
    const rooms = loadMeetRooms();
    const index = rooms.findIndex((r) => r.id === id);

    if (index === -1) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    if (isActive !== undefined) rooms[index].isActive = Boolean(isActive);
    if (lastJoinedAt) rooms[index].lastJoinedAt = lastJoinedAt;
    saveMeetRooms(rooms);

    res.json({ success: true, room: rooms[index] });
  });

  // Delete / close a Meet room
  router.delete('/rooms/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const actorEmail = (req.headers['x-user-email'] as string) || (req.query.userEmail as string);

    if (!actorEmail || !isAuthorizedOwnerEmail(actorEmail)) {
      res.status(403).json({ error: 'Only authorized owners can remove meeting rooms.' });
      return;
    }

    const rooms = loadMeetRooms();
    const filtered = rooms.filter((r) => r.id !== id);
    saveMeetRooms(filtered);

    res.json({ success: true, message: 'Meeting room removed successfully.' });
  });

  // Proxy to Google Meet v2 API using client-provided Bearer token
  router.post('/proxy/spaces', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Missing Authorization Bearer token.' });
      return;
    }

    try {
      const googleRes = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body || {}),
      });

      const data = await googleRes.json();
      res.status(googleRes.status).json(data);
    } catch (err: any) {
      console.error('[MeetRouter] Error proxying to Google Meet API:', err);
      res.status(502).json({ error: err?.message || 'Failed to communicate with Google Meet API.' });
    }
  });

  return router;
}
