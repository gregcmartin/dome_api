import { describe, expect, it } from "vitest";
import { parseNumber, parseUnixMilliseconds, parseUnixSeconds, requireApiKey } from "./parse.js";

describe("parseUnixSeconds", () => {
  it("parses integer strings as seconds", () => {
    expect(parseUnixSeconds("1700000000")).toBe(1700000000);
  });

  it("parses ISO strings to seconds", () => {
    expect(parseUnixSeconds("1970-01-01T00:00:01.000Z")).toBe(1);
  });
});

describe("parseUnixMilliseconds", () => {
  it("parses integer strings as milliseconds", () => {
    expect(parseUnixMilliseconds("1700000000000")).toBe(1700000000000);
  });

  it("parses ISO strings to milliseconds", () => {
    expect(parseUnixMilliseconds("1970-01-01T00:00:01.000Z")).toBe(1000);
  });
});

describe("parseNumber", () => {
  it("parses finite numbers", () => {
    expect(parseNumber("1.25")).toBe(1.25);
  });

  it("throws for non-numeric values", () => {
    expect(() => parseNumber("x")).toThrow('Expected a number, got "x"');
  });
});

describe("requireApiKey", () => {
  it("throws when key is missing", () => {
    expect(() => requireApiKey(undefined)).toThrow("Missing API key");
  });
});
