import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/db", () => ({ query: vi.fn() }));
vi.mock("../../lib/r2-storage", () => ({ getSignedDownloadUrl: vi.fn().mockResolvedValue("signed-url") }));

import { POST } from "../../app/api/reports/download/route";
import { query } from "../../lib/db";
import { getSignedDownloadUrl } from "../../lib/r2-storage";

describe("reports download route extra cases", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 in production when R2 is not configured", async () => {
    // @ts-ignore - Allow assignment for testing
    process.env.NODE_ENV = "production";
    process.env.R2_ACCESS_KEY_ID = "mock-1";
    process.env.R2_SECRET_ACCESS_KEY = "mock-2";
    process.env.R2_BUCKET_NAME = "";

    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", email: "a@b.com", phone: "1", suburb: "Albany", subscribe: false }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("uses default r2Key when no report row found", async () => {
    // @ts-ignore - Allow assignment for testing
    process.env.NODE_ENV = "test";
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ count: "0" }] } as any) // recent count
      .mockResolvedValueOnce({ rows: [] } as any) // reportResult empty
      .mockResolvedValueOnce({ rows: [{ id: "event-1" }] } as any) // insert
      .mockResolvedValueOnce({ rows: [] } as any); // update

    const req = new Request("http://localhost/api/reports/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "A", email: "a@b.com", phone: "1", suburb: "Northcross", subscribe: false }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.downloadUrl).toBe("signed-url");
    expect(vi.mocked(getSignedDownloadUrl).mock.calls[0][0]).toBe("reports/Northcross/latest.pdf");
  });
});
