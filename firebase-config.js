// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
// IMPORTANT: Paste your Firebase Web App configuration below.
// You can get this from the Firebase Console -> Project Settings -> General -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyA837FzEcof45-rqfeaJT1Kl5bLoV8zgtQ",
  authDomain: "fswd-jul26.firebaseapp.com",
  projectId: "fswd-jul26",
  storageBucket: "fswd-jul26.firebasestorage.app",
  messagingSenderId: "921056551712",
  appId: "1:921056551712:web:6a18700a5e8b29a1436d45",
  measurementId: "G-CYWK2RVJBH"
};

// Initialize Firebase App
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Initialize Services
const db = firebase.firestore();
const auth = firebase.auth();
