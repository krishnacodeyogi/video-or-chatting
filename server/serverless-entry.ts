import express from "express";
import mongoose from "mongoose";
import { registerRoutes } from "./routes";

// Source for the Vercel serverless function. This is bundled by esbuild into
// `api/index.js` (a single self-contained ESM file) so the runtime never has
// to resolve local TypeScript files — which @vercel/node does not handle
// reliably in this ESM project.
//
// Build:  npm run build:api   (esbuild ... --outfile=api/index.js)
//
// REST API only (auth, users, messages, groups, Cloudinary upload). Socket.IO
// signaling (calls + live presence) is NOT here — it needs a persistent host
// such as Render (see render.yaml).
//
// Required env vars on Vercel:
//   MONGODB_URI, SESSION_SECRET, CLOUDINARY_CLOUD_NAME,
//   CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

let initPromise: Promise<void> | null = null;

async function init(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const required = [
        "MONGODB_URI",
        "SESSION_SECRET",
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
      ];
      const missing = required.filter((k) => !process.env[k]);
      if (missing.length) {
        throw new Error(
          `Missing environment variables on Vercel: ${missing.join(", ")}`,
        );
      }
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI as string);
      }
      await registerRoutes(app);
    })();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await init();
  } catch (err: any) {
    initPromise = null;
    // eslint-disable-next-line no-console
    console.error("INIT_FAILED", err);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        error: "init_failed",
        message: String(err?.message ?? err),
        stack: err?.stack,
      }),
    );
    return;
  }
  return (app as unknown as (req: any, res: any) => void)(req, res);
}
