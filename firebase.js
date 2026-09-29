// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBRxsuOV1OnZsJpgO3IFOQt9k55jVQWl-I",
    authDomain: "panel-adefe.firebaseapp.com",
    projectId: "panel-adefe",
    storageBucket: "panel-adefe.firebasestorage.app",
    messagingSenderId: "188655498755",
    appId: "1:188655498755:web:3c2223eac1dde9cb49c036",
    measurementId: "G-JPWPTNVRLT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);