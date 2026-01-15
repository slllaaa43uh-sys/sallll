import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Safely access env
const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

let app = null;
let messaging = null;

try {
  // Only attempt to initialize if we have at least an API key
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    
    // Check for window/navigator to prevent SSR/Build errors
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
        try {
            messaging = getMessaging(app);
        } catch (e) {
            console.warn("Firebase Messaging not supported in this environment");
        }
    }
  } else {
      console.warn("Firebase Configuration missing. App will run in offline/demo mode.");
  }
} catch (error) {
  console.error("Firebase Initialization Error:", error);
}

export { messaging, getToken, onMessage };