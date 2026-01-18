import * as firebaseApp from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDARPhnSJrFbh4CD41D2uAerNSePkOdLqA",
  authDomain: "feriasdajana.firebaseapp.com",
  projectId: "feriasdajana",
  storageBucket: "feriasdajana.firebasestorage.app",
  messagingSenderId: "402522432768",
  appId: "1:402522432768:web:52245306c26b74b19a7fe5",
  measurementId: "G-2508HN4G9D"
};

// Initialize Firebase
// Cast to any to bypass potential type definition mismatches for initializeApp in some environments
const app = (firebaseApp as any).initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);