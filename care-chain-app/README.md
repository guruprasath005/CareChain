# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start Metro and the app

   ```bash
   npm start
   # or: npx expo start
   ```

   Optional: verify the project (dependencies, config, peers):

   ```bash
   npm run doctor
   ```

   Optional: confirm Metro can bundle without starting the dev server (web export):

   ```bash
   npx expo export --platform web --output-dir dist-web
   ```

3. **API URL (real phone or local backend)**

   - A **physical device** cannot reach `http://localhost` on your computer.
   - Copy `.env.example` → `.env` and set `EXPO_PUBLIC_API_URL` to  
     `http://<your-computer-LAN-IP>:<PORT>/api/v1` (same Wi‑Fi; backend default **`5001`** — on Mac, **avoid port 5000**; it is used by **AirPlay** and is not your API).
   - Use **Expo “LAN”** (not Tunnel) when testing against a machine on your network.
   - **iPhone + plain `http://` to your LAN IP:** iOS App Transport Security can block this (`Network request failed`). `app.json` sets `NSAllowsLocalNetworking`. **Expo Go may ignore your app’s plist** — if login still fails on a real device, use **`npx expo run:ios --device`** (dev build) or an **HTTPS** tunnel (ngrok, etc.) for `EXPO_PUBLIC_API_URL`.
   - Allow the API port through the Mac **firewall**; backend must listen on **`0.0.0.0`** (this repo’s server does).
   - If you skip `.env`, the app may fall back to the hosted production API so login still works.

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Features

### Search and Filter System

The app includes a comprehensive search and filter system for both doctor and hospital user flows. Key features include:

- Real-time text search with debouncing
- Multi-criteria filtering with persistence
- Independent search and filter controls
- Performance optimizations (duplicate prevention, request cancellation)
- Search history with suggestions
- Sort and pagination support

For detailed documentation, see [Search and Filter System Documentation](./docs/SEARCH_AND_FILTER_SYSTEM.md).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
