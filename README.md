# Open Source Neighborhood Safety & Alert Network

A mobile-first neighborhood safety and emergency alert system tailored for communities in India.

## Academic ROSP Project Structure

This project is planned across 10 progressive modules.

- **Module 1 — User & Authentication Management** *(Implemented)*
- Module 2 — Location & Neighborhood Management *(Future)*
- Module 3 — Incident Reporting *(Future)*
- Module 4 — Alert Management & Distribution *(Future)*
- Module 5 — Community Verification *(Future)*
- Module 6 — AI Trust & Reliability Engine *(Future)*
- Module 7 — Real-Time Communication & Notifications *(Future)*
- Module 8 — Admin & Moderation *(Future)*
- Module 9 — Reputation, Analytics & Reporting *(Future)*
- Module 10 — Security, Privacy & System Management *(Future)*

---

## Technology Stack

- **Mobile App**: React Native, React Navigation, Secure Storage Adapter (Android Keystore / iOS Keychain)
- **Backend API**: Node.js, Express, `pg` (PostgreSQL Client Pool), `bcrypt`, `jsonwebtoken`
- **Database**: PostgreSQL 16 with UUID extension
- **Email/SMS OTP**: Open-source SMTP adapter (`nodemailer`) + Mock SMS gateway abstraction for Indian mobile numbers (`+91`)
- **Zero Proprietary Cloud Services**: 100% free and open-source (No Firebase, No Supabase, No Auth0, No Twilio)

---

## Project Layout

```
NeighborhoodSafetyNetwork/
├── backend/            # Node.js Express REST API & PostgreSQL Migrations
│   ├── src/
│   ├── migrations/
│   └── tests/
├── frontend/
│   └── mobile/         # React Native Mobile Application
├── database/           # PostgreSQL Schema, DDL & Database Documentation
├── docs/               # Architecture & API Specifications
├── docker-compose.yml  # Local PostgreSQL container service
└── README.md
```

---

## Quick Start Guide

### 1. Start Database
```bash
# Start PostgreSQL container using Docker
docker-compose up -d postgres
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

### 3. Run Mobile App
```bash
cd ../frontend/mobile
npm install
npm start
```
