import express from "express";

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
      // Validate env up front so the error message is obvious.
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

      // Imported dynamically so any load-time error (e.g. DB/session setup)
      // is caught below and surfaced in the response instead of a blank 500.
      const mongoose = (await import("mongoose")).default;
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI as string);
      }
      const { registerRoutes } = await import("../server/routes");
      await registerRoutes(app);
    })();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  try {
    await init();
  } catch (err: any) {
    // Reset so the next request can retry, and surface the real cause.
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
