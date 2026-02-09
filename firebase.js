import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDdZorVyDz5OOYl2uPa3Vy96Lk4hM4ujPM",
  authDomain: "web-de-peliculas-92543.firebaseapp.com",
  projectId: "web-de-peliculas-92543",
  storageBucket: "web-de-peliculas-92543.firebasestorage.app",
  messagingSenderId: "492829259751",
  appId: "1:492829259751:web:0bf9ff5c928ccdd4c56f42"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();