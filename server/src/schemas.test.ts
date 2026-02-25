import { describe, it, expect } from "vitest";
import * as v from "valibot";
import {
  DevicePollSchema,
  PublicKeySchema,
  CreateProjectSchema,
  AddMemberSchema,
  ResolvePendingSchema,
  UploadFileSchema,
} from "./schemas.js";

describe("DevicePollSchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(DevicePollSchema, { device_code: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects missing device_code", () => {
    const result = v.safeParse(DevicePollSchema, {});
    expect(result.success).toBe(false);
  });
});

describe("CreateProjectSchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(CreateProjectSchema, {
      name: "my-project",
      encryptedProjectKey: "base64data",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = v.safeParse(CreateProjectSchema, {
      name: "",
      encryptedProjectKey: "base64data",
    });
    expect(result.success).toBe(false);
  });
});

describe("AddMemberSchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(AddMemberSchema, {
      username: "octocat",
      encryptedProjectKey: "key",
    });
    expect(result.success).toBe(true);
  });

  it("accepts input without encryptedProjectKey", () => {
    const result = v.safeParse(AddMemberSchema, { username: "octocat" });
    expect(result.success).toBe(true);
  });

  it("rejects empty username", () => {
    const result = v.safeParse(AddMemberSchema, {
      username: "",
      encryptedProjectKey: "key",
    });
    expect(result.success).toBe(false);
  });
});

describe("ResolvePendingSchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(ResolvePendingSchema, {
      members: [{ username: "octocat", encryptedProjectKey: "key" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty members array", () => {
    const result = v.safeParse(ResolvePendingSchema, { members: [] });
    expect(result.success).toBe(true);
  });

  it("rejects missing members", () => {
    const result = v.safeParse(ResolvePendingSchema, {});
    expect(result.success).toBe(false);
  });
});

describe("PublicKeySchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(PublicKeySchema, { publicKey: "abc" });
    expect(result.success).toBe(true);
  });
});

describe("UploadFileSchema", () => {
  it("accepts valid input", () => {
    const result = v.safeParse(UploadFileSchema, {
      encryptedContent: "encrypted",
    });
    expect(result.success).toBe(true);
  });
});
