// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import 'dotenv/config';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: "testing-maquila.firebaseapp.com",
  projectId: "testing-maquila",
  storageBucket: "testing-maquila.firebasestorage.app",
  messagingSenderId: process.env.SENDER_ID,
  appId: process.env.APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);