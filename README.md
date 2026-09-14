[README.md](https://github.com/user-attachments/files/32204683/README.md)
# 🎓 Fync — The All-in-One Campus Super-App

[![React Native](https://img.shields.io/badge/Mobile-React_Native_%7C_Expo-blue?logo=react&logoColor=white)](https://reactnative.dev/)
[![React](https://img.shields.io/badge/Web-React_19_%7C_Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_%7C_Express-green?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-MongoDB_%7C_Redis-red?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Research Paper](https://img.shields.io/badge/Research_Paper-IEEE_Preprint-orange.svg)](Fync_IEEE_Research_Paper.pdf)

> **Fync** brings your entire college life into **one single app**. Instead of switching between WhatsApp groups for notices, Google Drives for notes, external websites for coding, and informal chats for lost items, Fync combines **47 campus features** under a single student account.

---

## 💡 Why Fync? (The Problem We Solve)

In almost every college, student information is completely scattered:

| The Problem | How It Usually Works | How Fync Fixes It |
| :--- | :--- | :--- |
| **Lost Notices** | Buried under 1,000+ WhatsApp messages. | 📌 **Official Campus Notice Board** that never gets lost. |
| **Scattered Notes** | Random Google Drive links passed around. | 📚 **Notes Exchange** where you can search, view, and share study materials easily. |
| **Unverified Résumés** | Students write whatever they want on PDFs. | 🏆 **Verified Fync Score** automatically calculated from GitHub & coding achievements. |
| **No Local Connection** | LinkedIn and Instagram are global; hard to find campus peers. | 👥 **Campus-Only Social Feed** to find teammates, project partners, and clubs. |
| **Lost & Found Items** | Shared on random WhatsApp stories and forgotten. | 🔍 **Digital Lost & Found Ledger** with instant alerts. |

---

## ✨ Key Features at a Glance

### 📚 1. Academics & Study Hub
- **Free Notes Exchange:** Upload lecture notes and previous year question papers. Downloading notes is **always 100% free**.
- **AI Study Assistant:** Upload any syllabus PDF or study material and ask questions or generate practice exam questions powered by Google Gemini AI.
- **Attendance Tracker:** Calculate your attendance percentage and predict how many classes you can afford to miss or need to attend.

### 💼 2. Career, Jobs & Placements
- **Campus Interview Archive:** Real interview questions and experiences shared by seniors, searchable by company name, job role, and interview round.
- **AI Mock Interview:** Practice real-time voice interviews with instant feedback on your answers, communication, and confidence.
- **Placement Predictor:** Upload your résumé and CGPA to get insights on your readiness, salary expectations, and skill gaps.
- **Recruiter Dashboard:** Companies visiting campus can see verified student profiles with real GitHub and coding achievements instead of self-written claims.

### 💻 3. Coding Arena & Contests
- **1v1 Coding Battles:** Real-time head-to-head coding matches against peers.
- **Campus Contests:** Live coding competitions with automatic judging, timers, and real-time leaderboards.
- **Multiplayer Quiz Rooms:** Fast-paced technical and general knowledge quizzes.
- **Shadow Rival:** Quietly match with an anonymous batchmate for a friendly semester-long coding streak race.

### 👥 4. Social & Campus Life
- **Campus-Only Feed:** Share updates, tech news, project announcements, and club events exclusively with your college cohort.
- **24-Hour Disappearing Chat:** A fun campus chatroom where messages vanish every 24 hours.
- **Campus Marketplace:** Buy and sell second-hand textbooks, engineering calculators, cycles, and electronics safely with other students.
- **Peer Mentorship & Teammate Search:** Find teammates for upcoming hackathons based on technical skills (frontend, backend, AI/ML, UI/UX).
- **The 12 AM Club:** A special late-night audio and text space that unlocks exclusively between 12:00 AM and 6:00 AM.

### 🪙 5. Rewards & Campus Coins
- Earn **Fync Coins** by contributing useful lecture notes, participating in contests, and maintaining coding streaks.
- Redeem your coins in the **Campus Store** for physical goodies, books, stationery, and tech stickers!

---

## 🏗 How It Works (Simple Architecture)

Fync is designed to be lightweight, super fast, and cheap to run on affordable cloud hosting:

```
  ┌────────────────────────────────────────────────────────┐
  │                      CLIENTS                           │
  │   📱 Mobile App (React Native/Expo for Android & iOS)  │
  │   💻 Web App (React 19 for Coding Arena & Admin)       │
  └───────────────────────────┬────────────────────────────┘
                              │ HTTPS / WebSockets
  ┌───────────────────────────▼────────────────────────────┐
  │                    BACKEND SERVER                      │
  │   ⚡ Node.js & Express API Server                      │
  │   • Fast user authentication (JWT + OTP)               │
  │   • Live real-time chat & battles (Socket.IO)          │
  │   • Smart caching so pages load instantly              │
  └───────────────────────────┬────────────────────────────┘
                              │
  ┌───────────────────────────▼────────────────────────────┐
  │                  DATABASES & STORAGE                   │
  │   🍃 MongoDB: Stores user accounts, notes, and posts   │
  │   ⚡ Redis: Handles fast caching & online presence     │
  │   ☁️ Cloudflare R2: Stores PDFs, photos, and files     │
  └────────────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

- **Mobile Application:** [React Native](https://reactnative.dev/) with [Expo 54](https://expo.dev/) & [NativeWind](https://www.nativewind.dev/) (Tailwind CSS for mobile)
- **Web Application:** [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [Monaco Code Editor](https://microsoft.github.io/monaco-editor/)
- **Backend API:** [Node.js 20](https://nodejs.org/) & [Express 5](https://expressjs.com/)
- **Real-Time Communication:** [Socket.IO](https://socket.io/) (for live coding battles, notifications, and chat)
- **Primary Database:** [MongoDB](https://www.mongodb.com/) with Mongoose
- **Cache & Fast State:** [Redis](https://redis.io/) (for lightning-fast page loading and live online users)
- **File Storage:** [Cloudflare R2](https://www.cloudflare.com/products/r2/) (S3-compatible, zero bandwidth fees)
- **Code Execution:** [Judge0](https://judge0.com/) (runs student code safely in sandboxed environments)

---

## 📁 Project Directory Structure

```text
fync-platform/
├── mobile/                 # Mobile app for students (iOS & Android)
│   ├── app/                # App screens (Home, Feed, Arena, Profile, etc.)
│   ├── components/         # Reusable buttons, cards, modals
│   └── constants/          # Feature list and settings
│
├── web/                    # Desktop web portal
│   └── src/
│       ├── arena/          # Coding arena with Monaco Editor
│       └── admin/          # Admin moderation & problem authoring
│
├── server/                 # Backend REST & WebSocket API
│   ├── src/
│   │   ├── controllers/    # Request handlers (auth, notes, contests)
│   │   ├── models/         # Database schemas (User, Note, Contest)
│   │   ├── routes/         # API endpoints
│   │   └── services/       # Core logic (reputation score, coins, chat)
│   └── server.js           # Server startup script
│
└── docs/                   # Research paper & documentation
    └── Fync_IEEE_Research_Paper.pdf
```

---

## 🚀 Quick Setup (Run it Locally)

Follow these simple steps to run Fync on your own computer.

### Prerequisites
Make sure you have installed:
- [Node.js (v20 or higher)](https://nodejs.org/)
- [Git](https://git-scm.com/)
- [MongoDB](https://www.mongodb.com/try/download/community) & [Redis](https://redis.io/download/) (or run them via Docker)

---

### Step 1: Clone the Repo
```bash
git clone https://github.com/your-username/fync-platform.git
cd fync-platform
```

---

### Step 2: Start the Backend Server
```bash
cd server
npm install

# Copy sample environment settings
cp .env.example .env

# Start the development server
npm run dev
```
*Your server will start at `http://localhost:5000`.*

---

### Step 3: Run the Mobile App
Open a new terminal window:
```bash
cd mobile
npm install
npx expo start
```
- Download **Expo Go** on your phone (available on [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) and [App Store](https://apps.apple.com/app/expo-go/id982107779)).
- Scan the QR code shown in your terminal to open the app on your phone!

---

### Step 4: Run the Web Arena (Optional)
Open another terminal window:
```bash
cd web
npm install
npm run dev
```
*Your web coding arena will open at `http://localhost:5173`.*

---

## ⚙️ Simple `.env` Configuration Guide

In `server/.env`, configure these basic settings:

```ini
# Server Port
PORT=5000
NODE_ENV=development

# Database Connections
MONGO_URI=mongodb://localhost:27017/fync
REDIS_URL=redis://localhost:6379

# Security Keys (Put any secret random strings here)
JWT_SECRET=super_secret_jwt_key_12345
PROJECT_SECRET=internal_project_secret_key

# File Storage (Cloudflare R2 or AWS S3)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=fync-files

# AI Helper (Google Gemini API Key)
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🛡️ User Roles

Fync automatically adjusts what you can see based on your verified role:
- 👨‍🎓 **Student:** Access notes, 1v1 coding arena, feeds, clubs, and campus rewards.
- 🎓 **Alumni:** Exclusive alumni networking rooms, mentor current students, and post job referrals.
- 🏢 **Recruiter:** Search candidate profiles, view verified coding ratings and GitHub projects, and post hiring drives.
- 🛡️ **Admin:** Manage campus notices, approve rewards store redemptions, and moderate reported content.

---

## 📖 Research Paper

This project is backed by academic research demonstrating how to build a 47-service campus super-app on low-cost cloud hardware:

> **Fync: A Unified Campus Super-App Architecture for Higher Education Using Cost-Constrained Feature Consolidation**  
> *Authors:* Naimish Omar, Riya Gupta, Raja Parmar  
> *Faculty Supervisor:* Ms. Mani Dwivedi (Assistant Professor, Dept. of CSE)  
> *Institution:* KIET Group of Institutions (KIET Deemed University), Ghaziabad, UP, India  
> 📄 **[Read the Full Research Paper (PDF)](Fync_IEEE_Research_Paper.pdf)**

---

## 🤝 Contributing

Contributions make the open-source community amazing! To contribute:
1. **Fork** the repository.
2. Create a new branch: `git checkout -b feature/NewFeature`
3. Commit your changes: `git commit -m "Add NewFeature"`
4. Push to the branch: `git push origin feature/NewFeature`
5. Open a **Pull Request**.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## ❤️ Acknowledgments

Special thanks to the faculty members and students of **KIET Group of Institutions** for testing early builds, sharing notes, and giving valuable feedback!
