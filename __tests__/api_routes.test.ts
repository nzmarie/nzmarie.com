import { describe, it, expect, vi } from "vitest";
import { POST as captureIntent } from "../app/api/capture-intent/route";
import { POST as submitAppraisal } from "../app/api/submit-appraisal/route";

describe("POST /api/capture-intent", () => {
  it("returns success with body data on valid JSON", async () => {
    const req = new Request("http://localhost/api/capture-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: "2 Chelsea Lane", utmSource: "direct" }),
    });
    const res = await captureIntent(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.address).toBe("2 Chelsea Lane");
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/capture-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await captureIntent(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});

describe("POST /api/submit-appraisal", () => {
  it("returns success with body data on valid JSON", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Alice", email: "alice@example.com" }),
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.name).toBe("Alice");
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/submit-appraisal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await submitAppraisal(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });
});
