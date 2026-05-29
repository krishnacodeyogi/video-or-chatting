import express from "express";
import mongoose from "mongoose";
import { registerRoutes } from "../server/routes";

// Vercel serverless entry. Exposes the REST API only (auth, users, messages,
// groups, Cloudinary upload). Messaging uses the same 3s polling as the web
// client, which works fine on serverless.
//
// NOT included here: Socket.IO signaling (video/voice calls + live presence),
// because Vercel serverless functions cannot hold persistent connections. Run
// the full Node server (server/index.ts) on a persistent host (e.g. Render,
// see render.yaml) and point the app's SOCKET_URL at it for calls.
//
// Required environment variables on Vercel:
//   MONGODB_URI, SESSION_SECRET, CLOUDINARY_CLOUD_NAME,
//   CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI as string);
      }
      await registerRoutes(app);
    })();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  await init();
  return (app as unknown as (req: any, res: any) => void)(req, res);
}
