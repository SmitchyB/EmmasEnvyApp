# Mobile app

Expo React Native client for Emmas Envy. Includes **in-salon POS** (cash + optional Square) — not available on the website.

## Setup

```bash
cd mobile_app
cp .env.example .env
npm install
npm start          # Expo with cache clear
```

| Variable | Notes |
|----------|-------|
| `EXPO_PUBLIC_API_URL` | `http://localhost:5000` on emulator; **LAN IP** on physical device (e.g. `http://10.0.0.187:5000`) |

Backend must be running on `:5000`.

## Scripts

| Command | Use |
|---------|-----|
| `npm start` | Dev server (recommended) |
| `npm run start:tunnel` | When phone can't reach PC on LAN |
| `npm run android` / `ios` | Open on emulator/simulator |

## POS / Square (optional)

Cash works out of the box. For cards, set `EXPO_PUBLIC_SQUARE_*` in `.env` and `SQUARE_*` in `backend/.env`. Restart Expo after env changes.

## Device troubleshooting

**Can't connect?** Use `npm run start:tunnel` and scan the new QR code.

**API unreachable on phone?** Use your PC's LAN IP in `EXPO_PUBLIC_API_URL`, not `localhost`. Allow ports **5000** and **8081** through Windows Firewall for private networks.

**USB (Android):** `adb reverse tcp:8081 tcp:8081` and `adb reverse tcp:5000 tcp:5000`, then set API URL to `http://localhost:5000`.

Do **not** run `npm run reset-project` — it wipes the app screens.

Demo login: `demo1@fake.com` / `emma@fake.com` — password `Demo1234!` after seed.
