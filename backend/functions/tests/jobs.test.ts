import request from "supertest";
import { createApp } from "../lib/app.js";
import crypto from "crypto";

vi.mock("firebase-admin", () => {
  const setMock = vi.fn(() => Promise.resolve());
  const getMock = vi.fn(async () => ({ exists: true, data: () => ({ status: "done" }) }));
  const docMock = vi.fn(() => ({ set: setMock, get: getMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  return {
    default: {
      apps: [],
      initializeApp: vi.fn(),
      firestore: () => ({ collection: collectionMock }),
    },
  };
});

vi.mock("@google-cloud/pubsub", () => {
  return {
    PubSub: class {
      topic() {
        return { publishMessage: async () => {} };
      }
    },
  };
});

vi.mock("@google-cloud/storage", () => {
  return {
    Storage: class {
      bucket() {
        return {
          file() {
            return {
              getSignedUrl: async () => ["https://example.com/result.json"],
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

describe("jobs endpoints", () => {
  const secret = "test-secret";
  const prevEnv = process.env;
  beforeEach(() => {
    process.env = {
      ...prevEnv,
      ADDON_SHARED_SECRET: secret,
      GCS_BUCKET_UPLOADS: "uploads-bucket",
      GCS_BUCKET_JOBS: "jobs-bucket",
      SIGNED_URL_TTL_SECONDS: "3600",
      PDF_MAX_BYTES: "31457280",
      PDF_MAX_PAGES: "150",
    };
  });
  afterEach(() => {
    process.env = prevEnv;
    vi.restoreAllMocks();
  });

  it("creates a job and returns jobId", async () => {
    const app = createApp();
    const bodyObj = { uploadId: "upl_123", pdfName: "a.pdf", options: { theme: "DEFAULT" } };
    const body = JSON.stringify(bodyObj);
    const ts = Date.now();
    const sig = sign(secret, "POST", "/v1/jobs", ts, body);
    const res = await request(app)
      .post("/v1/jobs")
      .set("X-Timestamp", String(ts))
      .set("X-Signature", sig)
      .send(bodyObj);
    expect(res.status).toBe(200);
    expect(res.body.jobId).toMatch(/^job_/);
  });

  it("returns job status and signed result url when done", async () => {
    const app = createApp();
    const ts = Date.now();
    const body = "";
    const sig = sign(secret, "GET", "/v1/jobs/job_abc", ts, body);
    const res = await request(app)
      .get("/v1/jobs/job_abc")
      .set("X-Timestamp", String(ts))
      .set("X-Signature", sig);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("done");
    expect(res.body.result.resultJsonUrl).toContain("https://example.com/result.json");
  });
});


