// Firebase Configuration - Enhanced with Auth & Database exports
// Original config preserved from firebase.js in project root
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase, serverTimestamp } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBRxsuOV1OnZsJpgO3IFOQt9k55jVQWl-I",
  authDomain: "panel-adefe.firebaseapp.com",
  databaseURL: "https://panel-adefe-default-rtdb.firebaseio.com",
  projectId: "panel-adefe",
  storageBucket: "panel-adefe.firebasestorage.app",
  messagingSenderId: "188655498755",
  appId: "1:188655498755:web:3c2223eac1dde9cb49c036",
  measurementId: "G-JPWPTNVRLT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, database, googleProvider, serverTimestamp };
export default app;