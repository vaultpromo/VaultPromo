import { describe, it, expect } from "vitest";
import { loginSchema, signupSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "dj@test.com", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret" });
    expect(result.success).toBe(false);
  });

  it("rejects empty password", () => {
    const result = loginSchema.safeParse({ email: "dj@test.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("lowercases the email", () => {
    const result = loginSchema.safeParse({ email: "DJ@TEST.COM", password: "secret" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("dj@test.com");
  });
});

describe("signupSchema", () => {
  const valid = { name: "IMPCORE", email: "label@impcore.dev", password: "Secure1!" };

  it("accepts valid input", () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    const result = signupSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.flatten().fieldErrors.name?.[0]).toMatch(/2 characters/);
  });

  it("rejects password without a number", () => {
    const result = signupSchema.safeParse({ ...valid, password: "NoNumberHere!" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.flatten().fieldErrors.password).toBeDefined();
  });

  it("rejects password shorter than 8 chars", () => {
    const result = signupSchema.safeParse({ ...valid, password: "Ab1!" });
    expect(result.success).toBe(false);
  });
});

describe("workspace logic", () => {
  type Workspace = "label" | "dj";

  // Pure helper — mirrors the logic in switchWorkspaceAction
  function isValidWorkspace(w: unknown): w is Workspace {
    return w === "label" || w === "dj";
  }

  it("accepts label and dj", () => {
    expect(isValidWorkspace("label")).toBe(true);
    expect(isValidWorkspace("dj")).toBe(true);
  });

  it("rejects other strings", () => {
    expect(isValidWorkspace("admin")).toBe(false);
    expect(isValidWorkspace("")).toBe(false);
    expect(isValidWorkspace(null)).toBe(false);
  });
});
