import { sendClientEmail, type EmailMessage } from "./_core/email";

/**
 * Customer-facing notification templates + dispatch helpers. Each builder is a
 * pure function (easy to test); the send* helpers are best-effort wrappers.
 */
const ORDER_REF = (orderId: number) => `ORD-${String(orderId).padStart(6, "0")}`;

export function orderConfirmedEmail(to: string, orderId: number): EmailMessage {
  const ref = ORDER_REF(orderId);
  return {
    to,
    subject: `Your order ${ref} is confirmed`,
    text:
      `Thanks for your order.\n\n` +
      `Payment for ${ref} has been received and we've started provisioning your ` +
      `infrastructure. You can follow the progress live on your confirmation page.\n\n` +
      `— DatacenterMarket`,
  };
}

export function infrastructureReadyEmail(to: string, orderId: number): EmailMessage {
  const ref = ORDER_REF(orderId);
  return {
    to,
    subject: `Your infrastructure for ${ref} is ready`,
    text:
      `Good news — your infrastructure for ${ref} is provisioned and ready to use.\n\n` +
      `Head to your dashboard to access connection details and live metrics.\n\n` +
      `— DatacenterMarket`,
  };
}

export function paymentFailedEmail(to: string, orderId: number): EmailMessage {
  const ref = ORDER_REF(orderId);
  return {
    to,
    subject: `Payment issue with order ${ref}`,
    text:
      `We couldn't process the payment for ${ref}.\n\n` +
      `No infrastructure has been provisioned. You can retry the checkout from your ` +
      `dashboard at any time.\n\n` +
      `— DatacenterMarket`,
  };
}

export function sendOrderConfirmed(to: string, orderId: number): Promise<boolean> {
  return sendClientEmail(orderConfirmedEmail(to, orderId));
}

export function sendInfrastructureReady(to: string, orderId: number): Promise<boolean> {
  return sendClientEmail(infrastructureReadyEmail(to, orderId));
}

export function sendPaymentFailed(to: string, orderId: number): Promise<boolean> {
  return sendClientEmail(paymentFailedEmail(to, orderId));
}
