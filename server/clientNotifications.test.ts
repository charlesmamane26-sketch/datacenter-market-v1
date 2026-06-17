import { afterEach, describe, expect, it, vi } from "vitest";
import {
  orderConfirmedEmail,
  infrastructureReadyEmail,
  paymentFailedEmail,
  sendOrderConfirmed,
} from "./clientNotifications";
import { setEmailProvider, sendClientEmail, type EmailProvider } from "./_core/email";

afterEach(() => setEmailProvider(null));

describe("notification templates", () => {
  it("builds an order-confirmed email with a padded order ref", () => {
    const m = orderConfirmedEmail("a@b.com", 42);
    expect(m.to).toBe("a@b.com");
    expect(m.subject).toBe("Your order ORD-000042 is confirmed");
    expect(m.text).toContain("ORD-000042");
  });

  it("builds infra-ready and payment-failed emails", () => {
    expect(infrastructureReadyEmail("a@b.com", 7).subject).toContain("ORD-000007");
    expect(paymentFailedEmail("a@b.com", 7).subject).toContain("Payment issue");
  });
});

describe("sendClientEmail", () => {
  it("delegates to the active provider and returns its result", async () => {
    const sent: unknown[] = [];
    const fake: EmailProvider = {
      send: async m => (sent.push(m), true),
    };
    setEmailProvider(fake);

    const ok = await sendOrderConfirmed("user@example.com", 1);
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("skips an invalid recipient without calling the provider", async () => {
    const send = vi.fn();
    setEmailProvider({ send });
    expect(await sendClientEmail({ to: "not-an-email", subject: "x", text: "y" })).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("never throws even if the provider throws (best-effort)", async () => {
    setEmailProvider({
      send: async () => {
        throw new Error("smtp down");
      },
    });
    await expect(sendClientEmail({ to: "a@b.com", subject: "x", text: "y" })).resolves.toBe(false);
  });
});
