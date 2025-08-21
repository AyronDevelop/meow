import request from "supertest";
import express, { type Request, type Response } from "express";
import crypto from "crypto";
import { hmacAuth } from "../lib/middleware/hmac.js";

function sign(secret: string, method: string, path: string, ts: number, body: string) {
  return crypto.createHmac("sha256", secret).update(`${method}\n${path}\n${ts}\n${body}`).digest("base64");
}

describe("hmacAuth", () => {
  const secret = "test-secret";
  const app = express();
  app.use(express.json());
  app.use(hmacAuth(() => secret));
  app.post("/echo", (req: Request, res: Response) => res.json({ ok: true }));

  it("rejects without headers", async () => {
    const res = await request(app).post("/echo").send({});
    expect(res.status).toBe(401);
  });

  it("accepts with valid signature", async () => {
    const ts = Date.now();
    const body = JSON.stringify({ a: 1 });
    const sig = sign(secret, "POST", "/echo", ts, body);
    const res = await request(app)
      .post("/echo")
      .set("X-Timestamp", String(ts))
      .set("X-Signature", sig)
      .send({ a: 1 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});


