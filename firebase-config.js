// ============================================
// 🔥 Firebase Configuration - Sistem Absensi Kelas
// ============================================
// Import Firebase SDK (Modular v9+)
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

// ⬇️ PASTE config dari Firebase Console di bawah ini ⬇️
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyD73B6Dw36j3EQ66P23DqnJvBR7GNmwp9E",
  authDomain: "absensi-ff26f.firebaseapp.com",
  projectId: "absensi-ff26f",
  storageBucket: "absensi-ff26f.firebasestorage.app",
  messagingSenderId: "780253705957",
  appId: "1:780253705957:web:7f591a7d3413a948dc060c",
  measurementId: "G-JZKFX567WN",
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
