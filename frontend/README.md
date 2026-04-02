# Emmas Envy (Expo)

Frontend for the Emmas Envy nail salon app.

## Run the app

1. **Install dependencies** (once): `npm install`

2. **Start the dev server** (always use this so you get the latest code, not a cached welcome screen):
   ```bash
   npm start
   ```
   This runs `expo start --clear` to avoid cached bundles.

3. **Open on your phone or tablet (Expo Go)**  
   - Do **not** open `http://localhost:8081` in a browser on your phone. On the device, “localhost” is the device itself, so the app will never load.  
   - Open the **Expo Go** app, then **scan the QR code** from the terminal.  
   - **If scanning the QR code doesn’t connect** (stuck loading, “Couldn’t connect”, or “No apps connected”):
     - **Option A – Tunnel (recommended):** Stop the server (Ctrl+C), then run:
       ```bash
       npm run start:tunnel
       ```
       Scan the **new** QR code. Tunnel sends the bundle over the internet, so it works even when the phone and PC aren’t on the same Wi‑Fi or the firewall blocks port 8081. The first time may ask to install `@expo/ngrok` if needed.
     - **Option B – Same Wi‑Fi:** Put your phone and computer on the **same Wi‑Fi** (no guest network). Then try scanning again.
     - **Option C – Firewall:** On Windows, allow Node/Metro through the firewall for “Private” networks (port 8081) so your phone can reach `10.0.0.187:8081`. See **“Cannot connect to Metro”** below.

4. **Backend / API**  
   If you’re testing on a real device, set your computer’s LAN IP in `.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:3002
   ```
   Example: `EXPO_PUBLIC_API_URL=http://192.168.1.5:3002`

## Scripts

- `npm start` – Start with cache cleared (recommended)
- `npm run start:fast` – Start without clearing cache (faster, use after the app is loading correctly)
- `npm run android` / `npm run ios` – Start and open on emulator/simulator
- `npm run web` – Start for web browser (opens on your computer, not Expo Go)

## If you still see the old welcome screen

1. Stop the dev server (Ctrl+C).
2. Run `npm start` again (the `--clear` flag clears Metro’s cache).
3. In Expo Go on your device, **close the project** (e.g. swipe it away or “Leave project”), then scan the QR code again so it loads a fresh bundle.

Do **not** run `npm run reset-project`—that replaces the app with a blank template and removes the Emmas Envy screens.

## “Cannot connect to Metro” on phone (Expo Go)

If the app shows **“Cannot connect to Metro”** and the URL is your PC’s IP (e.g. `10.0.0.187:8081`), the phone cannot reach your PC. The same block usually affects the backend (port 3002), so API requests never reach the server.

**Fastest fix – use tunnel (no firewall changes):**

1. Stop Expo (Ctrl+C), then run:
   ```bash
   npm run start:tunnel
   ```
2. Scan the **new** QR code in Expo Go. The bundle is served via a tunnel, so the phone doesn’t need to reach your PC’s IP. Your `.env` still uses your PC’s LAN IP for the API (`EXPO_PUBLIC_API_URL=http://10.0.0.187:3002`); for tunnel, the phone and PC must still be on the same network (or you’d need a tunnel for the API too).

**If you want to use LAN (no tunnel) – allow ports in Windows Firewall:**

1. Open **Windows Security** → **Firewall & network protection** → **Allow an app through firewall** (or run `wf.msc` → “Inbound Rules”).
2. Find **Node.js JavaScript Runtime** (or add it: “Allow another app” → browse to your `node.exe`, e.g. in your nvm or Program Files folder). Ensure **Private** is checked so devices on your home network can connect.
3. **If Node is already allowed but the phone still can’t connect**, the rule may not apply to the process actually listening (e.g. different Node path). Add a **port-based** rule that always applies:
   - Press **Win+R**, type `wf.msc`, Enter.
   - **Inbound Rules** → **New Rule…** → **Port** → Next.
   - **TCP**, **Specific local ports:** `8081, 3002` → Next.
   - **Allow the connection** → Next → check **Private** (and **Domain** if you use it) → Next → name e.g. “Expo Metro + API” → Finish.
   - Restart Expo (`npm start`) and try the QR code again.
4. Confirm your PC’s Ethernet is seen as **Private**: **Settings** → **Network & Internet** → **Ethernet** → your connection → set “Network profile” to **Private** so the Private firewall rules apply.

**Alternative – phone over USB (no Wi‑Fi / firewall needed):**

1. Connect the phone with USB. Enable **USB debugging** (Developer options on the phone).
2. On the PC run: `adb devices` (install [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) if needed), then:
   ```bash
   adb reverse tcp:8081 tcp:8081
   adb reverse tcp:3002 tcp:3002
   ```
3. In the project `.env` set the API to localhost so the app talks to the reversed ports:
   ```env
   EXPO_PUBLIC_API_URL=http://localhost:3002
   ```
4. Start Expo with **LAN** (not tunnel): `npm start`. In Expo Go, open the project via **localhost** or the QR code; Metro and API will go over USB. When you switch back to Wi‑Fi testing, change `.env` back to `http://10.0.0.187:3002` and restart Expo.
