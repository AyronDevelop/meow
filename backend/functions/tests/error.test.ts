import request from "supertest";
import express from "express";
import { errorHandler, ApiError } from "../lib/errors.js";

describe("error handler", () => {
  it("formats ApiError", async () => {
    const app = express();
    app.get("/boom", () => {
      throw new ApiError(400, "BAD_REQUEST", "oops");
    });
    app.use(errorHandler());
    const res = await request(app).get("/boom");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("handles generic error as INTERNAL", async () => {
    const app = express();
    app.get("/boom", () => {
      throw new Error("kaboom");
    });
    app.use(errorHandler());
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL");
  });
});


