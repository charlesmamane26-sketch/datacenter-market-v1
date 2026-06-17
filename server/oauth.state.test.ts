import { describe, expect, it } from "vitest";
import { parseState } from "./_core/oauth";

/**
 * The OAuth `state` carries the redirect URI and a CSRF nonce. The callback
 * relies on parseState to recover both; these tests pin the two wire formats
 * (current JSON envelope + legacy bare URI) and the rejection of garbage.
 */
describe("parseState (OAuth CSRF nonce decoding)", () => {
  const encode = (value: string) => Buffer.from(value).toString("base64");

  it("decodes the JSON envelope { r, n } with redirect URI and nonce", () => {
    const state = encode(
      JSON.stringify({ r: "https://app.example.com/api/oauth/callback", n: "abc123" }),
    );
    expect(parseState(state)).toEqual({
      redirectUri: "https://app.example.com/api/oauth/callback",
      nonce: "abc123",
    });
  });

  it("decodes a legacy bare redirect URI with no nonce", () => {
    const state = encode("https://app.example.com/api/oauth/callback");
    expect(parseState(state)).toEqual({
      redirectUri: "https://app.example.com/api/oauth/callback",
    });
  });

  it("returns nonce=undefined when the envelope omits or mistypes it", () => {
    const state = encode(JSON.stringify({ r: "https://app.example.com/cb", n: 42 }));
    expect(parseState(state)).toEqual({
      redirectUri: "https://app.example.com/cb",
      nonce: undefined,
    });
  });

  it("falls back to the raw string when JSON lacks a string `r`", () => {
    // A JSON value without a usable `r` is treated as a legacy bare URI string.
    const state = encode(JSON.stringify({ something: "else" }));
    expect(parseState(state)).toEqual({ redirectUri: '{"something":"else"}' });
  });

  it("returns null for non-base64 / corrupt input", () => {
    // atob throws on input that cannot be base64-decoded.
    expect(parseState("not valid base64 !@#$%")).toBeNull();
  });
});
