import { describe, expect, it } from "vitest";
import { credentialsSchema } from "./auth.schemas";

describe("credentialsSchema", () => {
  it("trims valid email addresses and accepts the password length boundaries", () => {
    expect(
      credentialsSchema.safeParse({
        email: "  analyst@example.com ",
        password: "a".repeat(12),
      }),
    ).toMatchObject({
      success: true,
      data: { email: "analyst@example.com" },
    });
    expect(
      credentialsSchema.safeParse({
        email: "analyst@example.com",
        password: "a".repeat(128),
      }).success,
    ).toBe(true);
  });

  it("rejects malformed email and passwords outside the backend limits", () => {
    for (const password of ["short", "a".repeat(129)]) {
      expect(
        credentialsSchema.safeParse({
          email: "analyst@example.com",
          password,
        }).success,
      ).toBe(false);
    }

    expect(
      credentialsSchema.safeParse({
        email: "not-an-email",
        password: "a".repeat(12),
      }).success,
    ).toBe(false);
  });
});
