import { describe, expect, it } from "vitest";
import { parseFrontendEnv } from "./env";

describe("parseFrontendEnv", () => {
  it("accepts an absolute HTTP API base URL", () => {
    const result = parseFrontendEnv({
      VITE_API_BASE_URL: "http://localhost:3000/api/v1",
    });

    expect(result.success).toBe(true);
  });

  it("accepts a same-origin API path for development proxying", () => {
    expect(parseFrontendEnv({ VITE_API_BASE_URL: "/api/v1" }).success).toBe(
      true,
    );
  });

  it("rejects a missing or non-HTTP API base URL", () => {
    expect(parseFrontendEnv({}).success).toBe(false);
    expect(
      parseFrontendEnv({ VITE_API_BASE_URL: "file:///tmp/api" }).success,
    ).toBe(false);
    expect(
      parseFrontendEnv({ VITE_API_BASE_URL: "//example.com/api" }).success,
    ).toBe(false);
  });
});
