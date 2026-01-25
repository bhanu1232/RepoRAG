import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD-sq2DM6OEdjVLB_wokoS4NT0FKcGGOrQ",
  authDomain: "reporag-88980.firebaseapp.com",
  projectId: "reporag-88980",
  storageBucket: "reporag-88980.firebasestorage.app",
  messagingSenderId: "128141016195",
  appId: "1:128141016195:web:9101582180434bb2c8afb6",
  measurementId: "G-SEK7QPB6T0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { auth, googleProvider, analytics };
