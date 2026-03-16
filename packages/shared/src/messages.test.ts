import { describe, it, expect } from "vitest";
import { isIvyMessage, createMessage } from "./messages.js";

describe("isIvyMessage", () => {
  it("accepts a valid message", () => {
    expect(
      isIvyMessage({ type: "TRANSFORM_PAGE", payload: {} })
    ).toBe(true);
  });

  it("rejects null", () => {
    expect(isIvyMessage(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isIvyMessage(undefined)).toBe(false);
  });

  it("rejects a string", () => {
    expect(isIvyMessage("TRANSFORM_PAGE")).toBe(false);
  });

  it("rejects a number", () => {
    expect(isIvyMessage(42)).toBe(false);
  });

  it("rejects an object without type", () => {
    expect(isIvyMessage({ payload: {} })).toBe(false);
  });

  it("rejects an object without payload", () => {
    expect(isIvyMessage({ type: "TRANSFORM_PAGE" })).toBe(false);
  });

  it("rejects an object with non-string type", () => {
    expect(isIvyMessage({ type: 123, payload: {} })).toBe(false);
  });

  it("rejects an array", () => {
    expect(isIvyMessage([{ type: "TRANSFORM_PAGE", payload: {} }])).toBe(false);
  });

  it("accepts messages with extra fields", () => {
    expect(
      isIvyMessage({ type: "TOGGLE_IVY", payload: { enabled: true }, extra: "data" })
    ).toBe(true);
  });
});

describe("createMessage", () => {
  it("creates a message with correct structure", () => {
    const msg = createMessage("TOGGLE_IVY" as const, { enabled: true });
    expect(msg).toEqual({ type: "TOGGLE_IVY", payload: { enabled: true } });
  });

  it("creates an error message", () => {
    const msg = createMessage("ERROR" as const, {
      code: "TEST_ERROR",
      message: "Something went wrong",
      source: "service-worker" as const,
    });
    expect(msg.type).toBe("ERROR");
    expect(msg.payload.code).toBe("TEST_ERROR");
  });

  it("result passes isIvyMessage check", () => {
    const msg = createMessage("TRANSFORM_PAGE" as const, {
      url: "https://example.com",
      content: "test",
      regions: [],
    });
    expect(isIvyMessage(msg)).toBe(true);
  });
});
