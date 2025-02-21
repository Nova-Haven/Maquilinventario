import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

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
export const db = getFirestore(app);

// Enable emulators if on localhost
if (window.location.hostname === "localhost") {
  // Function to check if emulator is running
  const checkEmulator = async (port) => {
    try {
      const response = await fetch(`http://localhost:${port}`);
      return response.status !== 404;
    } catch {
      return false;
    }
  };

  // Check and connect emulators
  Promise.all([checkEmulator(9099), checkEmulator(8088)]).then(
    ([authRunning, firestoreRunning]) => {
      if (!authRunning) {
        console.warn(
          "⚠️ Auth emulator not running. Start with: firebase emulators:start"
        );
      } else {
        connectAuthEmulator(auth, "http://localhost:9099");
        console.log("✅ Connected to Auth emulator");
      }

      if (!firestoreRunning) {
        console.warn(
          "⚠️ Firestore emulator not running. Start with: firebase emulators:start"
        );
      } else {
        connectFirestoreEmulator(db, "localhost", 8088);
        console.log("✅ Connected to Firestore emulator");
      }
    }
  );
}
