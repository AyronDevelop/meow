import request from "supertest";
import { createApp } from "../lib/app.js";
import crypto from "crypto";

vi.mock("@google-cloud/storage", () => {
  return {
    Storage: class MockStorage {
      bucket() {
        return {
          file() {
            return {
              getSignedUrl: async () => ["https://signed-url.example/upload"],
            };
          },
        };
      }
    }
  };
});

function sign(secret: string, method: string, path: string, ts: number, body: string) {
  return crypto.createHmac("sha256", secret).update(`${method}\n${path}\n${ts}\n${body}`).digest("base64");
}

describe("POST /v1/uploads/signed-url", () => {
  const secret = "test-secret";
  const prevEnv = process.env;
  beforeEach(() => {
    process.env = { ...prevEnv, ADDON_SHARED_SECRET: secret, GCS_BUCKET_UPLOADS: "bucket", SIGNED_URL_TTL_SECONDS: "3600", PDF_MAX_BYTES: "31457280", PDF_MAX_PAGES: "150", ANTI_REPLAY_ENABLED: "false" };
  });
  afterEach(() => {
    process.env = prevEnv;
  });

  it("returns signed url for valid request", async () => {
    const app = createApp();
    const bodyObj = { fileName: "a.pdf", contentType: "application/pdf", contentLength: 1000, contentSha256: "a".repeat(64) };
    const body = JSON.stringify(bodyObj);
    const ts = Date.now();
    const sig = sign(secret, "POST", "/v1/uploads/signed-url", ts, body);
    const res = await request(app)
      .post("/v1/uploads/signed-url")
      .set("X-Timestamp", String(ts))
      .set("X-Signature", sig)
      .send(bodyObj);
    expect(res.status).toBe(200);
    expect(res.body.uploadId).toMatch(/^upl_/);
    expect(res.body.uploadUrl).toContain("https://signed-url.example");
  });

  it("rejects oversize file", async () => {
    const app = createApp();
    const bodyObj = { fileName: "a.pdf", contentType: "application/pdf", contentLength: 999999999, contentSha256: "a".repeat(64) };
    const body = JSON.stringify(bodyObj);
    const ts = Date.now();
    const sig = sign(secret, "POST", "/v1/uploads/signed-url", ts, body);
    const res = await request(app)
      .post("/v1/uploads/signed-url")
      .set("X-Timestamp", String(ts))
      .set("X-Signature", sig)
      .send(bodyObj);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PDF_TOO_LARGE");
  });
});


