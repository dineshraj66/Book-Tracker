# 📖 PageTurn – Book Tracker

A beautiful, installable PWA for tracking your reading journey. Works on mobile and desktop.

---

## ✨ Features

- 📱 **Installable as native app** on iOS, Android, and Desktop (PWA)
- 🔥 **Firebase Firestore** for real-time cloud sync across devices
- 🏠 **Home page** — Current book(s) with progress bar & page updater
- 🎯 **Reading Goal** — Set yearly target, track completed vs. goal
- 📚 **Library** — All in-progress books, filter by category
- ✅ **History** — Completed books with days taken to finish
- 📊 **Stats** — Monthly chart, streaks, averages & more

---

## 🚀 Setup Instructions

### Step 1 – Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/pageturn-book-tracker.git
cd pageturn-book-tracker
```

### Step 2 – Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** → name it (e.g. `pageturn`)
3. Disable Google Analytics (optional) → Create project

### Step 3 – Enable Firestore

1. In Firebase Console → **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development)
4. Select a region → Done

### Step 4 – Get Firebase Config

1. Firebase Console → **Project Settings** (⚙️ gear icon)
2. Under "Your apps" → Click **"</> Web"**
3. Register app name → Copy the `firebaseConfig` object

### Step 5 – Update app.js

Open `app.js` and replace the `FIREBASE_CONFIG` object at the top:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

### Step 6 – Deploy to GitHub Pages

1. Push to GitHub:
```bash
git add .
git commit -m "Initial PageTurn deploy"
git push origin main
```

2. In your GitHub repo → **Settings** → **Pages**
3. Source: **Deploy from a branch** → Branch: `main` → Folder: `/ (root)`
4. Save → Your app will be live at `https://YOUR_USERNAME.github.io/pageturn-book-tracker/`

### Step 7 – Secure Firestore (Production)

Replace test mode rules in Firebase Console → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Change this to auth rules for production
    }
  }
}
```

---

## 📱 Installing as Native App

### iOS (Safari)
1. Open your GitHub Pages URL in Safari
2. Tap **Share** → **"Add to Home Screen"**
3. Tap **Add** → App appears on home screen!

### Android (Chrome)
1. Open the URL in Chrome
2. Tap the **"Install"** banner or Menu → **"Add to Home Screen"**

### Desktop (Chrome/Edge)
1. Open the URL
2. Click the **install icon** (➕) in the address bar
3. Click **Install**

---

## 📁 Project Structure

```
pageturn-book-tracker/
├── index.html        # Main app shell
├── style.css         # All styles
├── app.js            # App logic + Firebase integration
├── manifest.json     # PWA manifest
├── sw.js             # Service worker (offline support)
├── icons/
│   ├── icon-192.png  # PWA icon
│   └── icon-512.png  # PWA icon (large)
└── README.md
```

---

## 🔧 Offline Mode

If Firebase is not configured or unreachable, the app automatically falls back to **localStorage**. Your data stays on-device until Firebase is available.

---

## 📊 Stats Explained

| Stat | Description |
|------|-------------|
| Total Books Read | All completed books |
| In Progress | Currently reading |
| Avg Days to Complete | Mean across all completed books |
| Longest / Shortest | Extremes in completion time |
| Avg Pages/Day | Total pages ÷ total reading days |
| Longest Streak | Most consecutive days with reading logged |
| Current Streak | Ongoing reading streak |

---

## 🛠 Built With

- Vanilla JavaScript (no build step needed!)
- Firebase Firestore
- Progressive Web App (PWA) APIs
- Google Fonts: Playfair Display + DM Sans

---

*Happy reading! 📚*
