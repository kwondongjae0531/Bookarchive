import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyBcUAwDCZ_qRweJluQ-uYfJEvpeduVnX-g",
  authDomain: "book-archive-fb00f.firebaseapp.com",
  projectId: "book-archive-fb00f",
  storageBucket: "book-archive-fb00f.firebasestorage.app",
  messagingSenderId: "179861932943",
  appId: "1:179861932943:web:4f584395e1b344793299fa"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);