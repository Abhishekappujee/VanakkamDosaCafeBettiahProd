/**
 * Firebase Config & Realtime Database Initialization Module
 */

// Firebase Web SDK Configuration
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyD1tM6WAYaKkkxD9BVUBl247oQcPt6yCn8",
  authDomain: "vanakkamdosa-404d1.firebaseapp.com",
  databaseURL: "https://vanakkamdosa-404d1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "vanakkamdosa-404d1",
  storageBucket: "vanakkamdosa-404d1.firebasestorage.app",
  messagingSenderId: "1075334991260",
  appId: "1:1075334991260:web:41fa09f30c23b73640cc59",
  measurementId: "G-Y53PY8Y38C"
};

window.AppState = {
  isFirebaseAvailable: false,
  currentUser: null,
  activeSession: null,
  listeners: {}
};

// Initialize Official Firebase Web SDK
if (typeof firebase !== 'undefined') {
  try {
    const config = window.FIREBASE_CONFIG || (typeof firebaseConfig !== 'undefined' ? firebaseConfig : null);
    if (!firebase.apps.length && config) {
      firebase.initializeApp(config);
    }
    window.firebaseApp = firebase.app();
    window.firebaseAuth = firebase.auth();
    window.firebaseDB = firebase.database();
    window.AppState.isFirebaseAvailable = true;
    console.log("🔥 Firebase Realtime Database & Auth initialized successfully!");

    // Monitor Firebase RTDB Connection Status
    window.firebaseDB.ref('.info/connected').on('value', (snap) => {
      updateConnectionStatus(snap.val() === true);
    });
  } catch(e) {
    console.warn("Firebase SDK initialization fallback:", e);
  }
}

window.addEventListener('online', () => updateConnectionStatus(true));
window.addEventListener('offline', () => updateConnectionStatus(false));

function updateConnectionStatus(isOnline) {
  const banner = document.getElementById('connection-status-banner');
  if (!banner) return;
  if (isOnline) {
    banner.style.transform = "translateY(-100%)";
    banner.style.display = "none";
  } else {
    banner.style.display = "block";
    banner.textContent = "⚠️ Offline Mode - Working offline & syncing locally";
    banner.className = "offline";
    banner.style.transform = "translateY(0)";
  }
}

// Toast Notification System
window.showToast = function(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'danger') icon = '❌';
  if (type === 'warning') icon = '⚠️';

  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.5rem;">
      <span>${icon}</span>
      <span>${message}</span>
    </div>
    <button onclick="this.parentElement.remove()" style="opacity:0.7; font-weight:bold;">✕</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

window.formatCurrency = function(amount) {
  const num = parseFloat(amount || 0);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

window.generateId = function(prefix = 'ID') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
};

window.formatDateTime = function(timestamp) {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};
