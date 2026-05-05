# 🚗 Smart Parking Manager (SPM) - Renault Internal

A premium, full-stack real-time parking management system designed for Renault's internal logistics and vehicle storage sectors (RHL, Contine).

![Confidential](https://img.shields.io/badge/Status-Confidential-red)
![Version](https://img.shields.io/badge/Version-1.0.0-yellow)
![Tech](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20SQLite-blue)

## 🌟 Overview

The **Smart Parking Manager** is a "Command Center" style dashboard that provides real-time visibility and control over vehicle storage. It enables operators to track vehicle positions via VIN, manage reservations, and monitor retention cycles with automated alerts for overstaying vehicles.

## ✨ Key Features

- **Interactive 2D Maps**: Real-time visual representation of parking blocks (A-I) with high-fidelity car visualizations.
- **Real-Time Updates**: Instant synchronization across all connected clients via Socket.io.
- **Retention Management**: Automatic tracking of parking duration with visual alerts for vehicles exceeding the 6-day limit.
- **VIN Operations**: 
  - Quick VIN Scanning and Search.
  - Precise byte-perfect mapping for vehicle data.
- **Smart Reservations**: Support for individual and bulk reservations (Multi-spot) based on person identity (Nom/Prénom).
- **Virtual Sectors**: Create and manage "Virtual Parking" zones for additional storage flexibility.
- **Role-Based Access**: 
  - **Operator**: Daily operations (Maps, Scan, Release).
  - **Supervisor/Admin**: Analytics, User Management, System Settings, and Audit Logs.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **State**: Zustand (Atomic State Management)
- **UI/UX**: 
  - Vanilla CSS (Premium Design System)
  - Framer Motion (Micro-animations)
  - Lucide React (Icons)
  - Recharts (Analytics)
- **Communication**: Socket.io-client, Axios

### Backend
- **Runtime**: Node.js + Express
- **Database**: SQLite (Better-SQLite3) with WAL mode
- **Real-Time**: Socket.io
- **Security**: JWT, BcryptJS, Helmet, CORS
- **Validation**: Zod

## 📂 Project Structure

```text
Renault-Parking 2/
├── backend/            # Express API & SQLite DB
│   ├── src/
│   │   ├── config/     # Database & App config
│   │   ├── middleware/ # Auth & Validation
│   │   └── routes/     # Modular API endpoints
│   └── server.js       # Entry Point
├── frontend/           # React Application
│   ├── src/
│   │   ├── components/ # Reusable UI units
│   │   ├── pages/      # View components
│   │   ├── store/      # Zustand state
│   │   └── index.css   # Global Design System
│   └── vite.config.js  # Build config
└── vercel.json         # Deployment config
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or yarn

### 1. Backend Setup
```bash
cd backend
npm install
# Create .env (copy from .env.example)
# The database (parking.db) will be automatically initialized and seeded on first run
node server.js
```

### 2. Frontend Setup
```bash
cd frontend
npm install
# Create .env with VITE_API_URL=http://localhost:3001
npm run dev
```

## 🔒 Security Note
This application is designed for **Renault Internal Use Only**. It contains confidential logic regarding logistics operations. Ensure all `.env` files and the `parking.db` are excluded from public repositories.

## 👤 Author
**Abdellah Elberkaoui**
*Software Engineer | Industrial Digitalization*
[LinkedIn](https://linkedin.com/in/abdellah-elberkaoui-1a3493195)

---
© 2026 Renault Group | Confidential & Proprietary
