import { describe, expect, it } from "vitest";
import { isStorageKeyPublic, normalizePublicStorageKey } from "./storageProxy";

describe("public storage key validation", () => {
  it("accepts bounded ASCII object keys and nested prefixes", () => {
    expect(normalizePublicStorageKey("image_a1b2c3d4.png")).toBe(
      "image_a1b2c3d4.png"
    );
    expect(normalizePublicStorageKey("public/orders/contract-42.pdf")).toBe(
      "public/orders/contract-42.pdf"
    );
  });

  it.each([
    "../secret",
    "public/../secret",
    "public\\secret",
    ".hidden",
    "public//file.png",
    `public/${"a".repeat(513)}`,
  ])("rejects unsafe storage key %s", key => {
    expect(normalizePublicStorageKey(key)).toBeNull();
  });

  it("enforces configured public prefixes without prefix confusion", () => {
    expect(isStorageKeyPublic("public/image.png", "public,contracts")).toBe(
      true
    );
    expect(isStorageKeyPublic("contracts/42.pdf", "public,contracts")).toBe(
      true
    );
    expect(isStorageKeyPublic("publicity/image.png", "public,contracts")).toBe(
      false
    );
    expect(isStorageKeyPublic("private/image.png", "public,contracts")).toBe(
      false
    );
  });

  it("fails closed when a configured prefix is malformed", () => {
    expect(isStorageKeyPublic("public/image.png", "../public")).toBe(false);
    expect(isStorageKeyPublic("public/image.png", "public,../private")).toBe(
      false
    );
  });
});
