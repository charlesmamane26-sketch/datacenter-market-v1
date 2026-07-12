import { ENV } from "./env";

/**
 * Client-facing email notifications (order confirmed, infrastructure ready,
 * payment failed). Distinct from notifyOwner, which pings the project owner via
 * the Manus service — this sends to an arbitrary recipient (the customer).
 *
 * Transport is pluggable. The default is a no-op that just logs, so the app runs
 * without an email provider (same posture as Stripe/Redis without their keys).
 * A real provider is activated by setting EMAIL_API_URL + EMAIL_API_KEY; the
 * HTTP provider POSTs a simple JSON payload a transactional API can consume.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<boolean>;
}

const FROM = "DatacenterMarket <no-reply@datacentermarket>";

/**
 * Redacts a recipient address for logging: keeps the first local char and the
 * domain so a log line stays useful for debugging without writing full customer
 * PII to server logs (which are outside db:purge / leads.delete scope).
 * "alice@corp.com" -> "a***@corp.com".
 */
function maskEmail(address: string): string {
  const at = address.indexOf("@");
  if (at <= 0) return "***";
  return `${address[0]}***${address.slice(at)}`;
}

const noopProvider: EmailProvider = {
  async send(message) {
    console.log(`[Email] (disabled) would send "${message.subject}" to ${maskEmail(message.to)}`);
    return false;
  },
};

function httpProvider(apiUrl: string, apiKey: string): EmailProvider {
  return {
    async send(message) {
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ from: FROM, ...message }),
        });
        if (!res.ok) {
          console.warn(`[Email] Provider rejected message (${res.status})`);
          return false;
        }
        return true;
      } catch (error) {
        console.warn("[Email] Provider error:", String(error));
        return false;
      }
    },
  };
}

let provider: EmailProvider | null = null;

/** Resolve the active provider (memoized): HTTP when configured, else no-op. */
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  if (ENV.emailApiUrl && ENV.emailApiKey) {
    provider = httpProvider(ENV.emailApiUrl, ENV.emailApiKey);
  } else {
    provider = noopProvider;
  }
  return provider;
}

/** Test-only: override the active provider. */
export function setEmailProvider(p: EmailProvider | null): void {
  provider = p;
}

/**
 * Best-effort client email. Never throws: a failed send must not break the flow
 * that triggered it (a Stripe webhook, a provisioning update). Skips invalid /
 * empty recipients. Returns whether the provider accepted the message.
 */
export async function sendClientEmail(message: EmailMessage): Promise<boolean> {
  if (!message.to || !message.to.includes("@")) {
    console.warn("[Email] Skipping send: invalid recipient");
    return false;
  }
  try {
    return await getEmailProvider().send(message);
  } catch (error) {
    console.warn("[Email] Unexpected send error:", String(error));
    return false;
  }
}
