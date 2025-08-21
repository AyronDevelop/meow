import "dotenv/config";
import * as functions from "firebase-functions";
import { createApp } from "./app.js";
export { jobsWorker } from "./worker.js";

const app = createApp();

export const api = functions
  .region(process.env.REGION || "us-central1")
  .runWith({ memory: "1GB", timeoutSeconds: 300, minInstances: 0, secrets: ["ADDON_SHARED_SECRET"] })
  .https.onRequest(app);

