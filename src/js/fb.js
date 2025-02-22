import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Enable emulators if on localhost
if (window.location.hostname === "localhost") {
  const AUTH_PORT = 9099;

  const checkEmulator = async (port) => {
    try {
      const response = await fetch(`http://localhost:${port}`, {
        method: "GET",
        timeout: 2000, // 2 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const connectToEmulator = async () => {
    try {
      const isEmulatorRunning = await checkEmulator(AUTH_PORT);

      if (!isEmulatorRunning) {
        console.warn(`
          ⚠️ Firebase Auth emulator not running
          Run this command in your terminal:
          $ firebase emulators:start
          
          Make sure you have Firebase CLI installed:
          $ npm install -g firebase-tools
        `);
        return false;
      }

      connectAuthEmulator(auth, `http://localhost:${AUTH_PORT}`, {
        disableWarnings: true,
      });
      console.log("✅ Connected to Firebase Auth emulator");
      return true;
    } catch (error) {
      console.error("❌ Failed to connect to emulator:", error.message);
      return false;
    }
  };

  // Initialize emulator connection
  connectToEmulator().catch((error) => {
    console.error("❌ Emulator initialization failed:", error);
  });
}
