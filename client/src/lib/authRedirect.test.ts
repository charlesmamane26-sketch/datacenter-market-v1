import { describe, expect, it } from "vitest";
import { unauthenticatedRedirectPath } from "./authRedirect";

describe("unauthenticatedRedirectPath", () => {
  it("sends protected pages to the branded login route", () => {
    expect(unauthenticatedRedirectPath("/dashboard")).toBe("/login");
  });

  it("does not loop when the visitor is already on the login route", () => {
    expect(unauthenticatedRedirectPath("/login")).toBeNull();
  });
});
