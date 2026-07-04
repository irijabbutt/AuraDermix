import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// __FIREBASE_APPLET_CONFIG__ is globally injected at build-time from firebase-applet-config.json
const config = typeof __FIREBASE_APPLET_CONFIG__ !== 'undefined' ? __FIREBASE_APPLET_CONFIG__ : {} as any;

// Use the actual AI Studio sandbox database configuration as default fallback
const isConfigured = !!(import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey || "AIzaSyCi9XfbvTWiTm9H0iCdeQyw8-YKjfgOzY4");

if (!isConfigured) {
  console.warn(
    "Firebase configuration is missing. The application will run in local-only offline mode with dummy services. " +
    "To enable secure persistent Cloud Sync, configure your Firebase environment variables or provide firebase-applet-config.json."
  );
}

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || config.projectId || "composed-amulet-474111-t4",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || config.appId || "1:166946553437:web:4a89344d27b5abbc9297b4",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || config.apiKey || "AIzaSyCi9XfbvTWiTm9H0iCdeQyw8-YKjfgOzY4",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain || "composed-amulet-474111-t4.firebaseapp.com",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket || "composed-amulet-474111-t4.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId || "166946553437",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || config.measurementId || ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || config.firestoreDatabaseId || "ai-studio-auradermix-a3715676-a5df-4080-8969-53498786b7bb");
export const isFirebaseActive = isConfigured;

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

