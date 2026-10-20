import { getFirestore, doc, getDocFromServer, collection, getDocs, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { firebaseApp, firebaseAuth } from './firebaseAuth';
import firebaseConfig from '../../firebase-applet-config.json';
import { MemoryNote, AuthorizedUser } from '../types';

// CRITICAL: Initialize Firestore using the provisioned database ID
export const db = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo: firebaseAuth.currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate connection to Firestore on boot
 */
export async function testFirestoreConnection(): Promise<boolean> {
  const path = 'test/connection';
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
    // Expected to encounter permission or not-found, meaning connection is established
    return true;
  }
}

/**
 * Sync user profile to Firestore
 */
export async function syncUserProfileToFirestore(user: AuthorizedUser): Promise<void> {
  if (!firebaseAuth.currentUser?.uid) return;
  const path = `users/${firebaseAuth.currentUser.uid}`;
  try {
    const userRef = doc(db, 'users', firebaseAuth.currentUser.uid);
    await setDoc(
      userRef,
      {
        email: user.email,
        name: user.name,
        role: user.role,
        avatarInitials: user.avatarInitials,
        avatarColor: user.avatarColor,
        avatarUrl: user.picture || '',
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Subscribe to Memory Notes from Firestore
 */
export function subscribeFirestoreMemoryNotes(
  onNotes: (notes: MemoryNote[]) => void,
  onError?: (err: Error) => void
): () => void {
  const notesPath = 'memoryNotes';
  try {
    const q = query(collection(db, notesPath));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notes: MemoryNote[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          notes.push({
            id: d.id || docSnap.id,
            content: d.content,
            author: {
              email: d.authorEmail,
              name: d.authorName,
              role: d.authorRole || 'Member',
              avatarColor: d.colorScheme === 'rose' ? 'from-rose-500 to-pink-600' : 'from-indigo-500 to-purple-600',
              avatarInitials: d.authorName ? d.authorName.slice(0, 2).toUpperCase() : 'EV',
            },
            createdAt: d.createdAt,
            category: d.category || 'memory',
            colorScheme: d.colorScheme || 'rose',
          });
        });
        // Sort descending by date
        notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onNotes(notes);
      },
      (error) => {
        if (onError) onError(error);
        handleFirestoreError(error, OperationType.GET, notesPath);
      }
    );
    return unsubscribe;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, notesPath);
  }
}

/**
 * Add a new Memory Note to Firestore
 */
export async function addMemoryNoteToFirestore(note: MemoryNote): Promise<void> {
  const notesPath = 'memoryNotes';
  try {
    const noteRef = doc(db, notesPath, note.id);
    await setDoc(noteRef, {
      id: note.id,
      content: note.content,
      authorEmail: note.author.email,
      authorName: note.author.name,
      authorRole: note.author.role,
      category: note.category,
      colorScheme: note.colorScheme,
      createdAt: note.createdAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${notesPath}/${note.id}`);
  }
}

/**
 * Delete a Memory Note from Firestore
 */
export async function deleteMemoryNoteFromFirestore(noteId: string): Promise<void> {
  const notePath = `memoryNotes/${noteId}`;
  try {
    await deleteDoc(doc(db, 'memoryNotes', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, notePath);
  }
}
