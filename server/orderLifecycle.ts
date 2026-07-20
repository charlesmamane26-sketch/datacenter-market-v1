export type OrderStatus =
  | "pending"
  | "processing"
  | "provisioning"
  | "active"
  | "cancelled"
  | "completed";

export type PaymentStatus = "pending" | "succeeded" | "failed" | "cancelled";

export type ProvisioningEventType =
  | "order_received"
  | "provider_matching"
  | "contract_generation"
  | "provisioning"
  | "ready";

export type ProvisioningEventStatus = "pending" | "in_progress" | "completed" | "failed";

export interface OrderLifecycleState {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  provisioningStartedAt?: Date | null;
  provisioningCompletedAt?: Date | null;
}

export interface OrderLifecyclePatch {
  status?: OrderStatus;
  provisioningStartedAt?: Date;
  provisioningCompletedAt?: Date;
}

export class OrderLifecycleError extends Error {}

const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  pending: 0,
  processing: 1,
  provisioning: 2,
  active: 3,
  completed: 4,
};

const TERMINAL_STATUSES = new Set<OrderStatus>(["cancelled", "completed"]);

function advanceStatus(current: OrderStatus, target: OrderStatus): OrderStatus | undefined {
  const currentRank = STATUS_RANK[current];
  const targetRank = STATUS_RANK[target];
  if (currentRank == null || targetRank == null || targetRank <= currentRank) return undefined;
  return target;
}

/**
 * Enforces the operational state machine for the emergency/manual admin status
 * control. Payment is still owned by Stripe: an unpaid order can only stay
 * pending or be cancelled, never become an active service.
 */
export function assertManualOrderTransition(
  order: Pick<OrderLifecycleState, "status" | "paymentStatus">,
  target: OrderStatus,
): void {
  if (target === order.status) return;
  if (TERMINAL_STATUSES.has(order.status)) {
    throw new OrderLifecycleError(`An order in status ${order.status} is terminal.`);
  }
  if (target === "pending") {
    throw new OrderLifecycleError("An order cannot be moved back to pending.");
  }
  if (target !== "cancelled" && order.paymentStatus !== "succeeded") {
    throw new OrderLifecycleError("Stripe must confirm payment before service activation.");
  }
  const currentRank = STATUS_RANK[order.status];
  const targetRank = STATUS_RANK[target];
  if (target !== "cancelled" && currentRank != null && targetRank != null && targetRank < currentRank) {
    throw new OrderLifecycleError("An order cannot move backwards in the service lifecycle.");
  }
}

/**
 * Derives the order-level state change caused by an admin provisioning event.
 * The event remains the audit/timeline entry; this patch keeps the order summary
 * shown in dashboards consistent with that timeline.
 */
export function deriveProvisioningOrderPatch(
  order: OrderLifecycleState,
  event: { eventType: ProvisioningEventType; status: ProvisioningEventStatus },
  now = new Date(),
): OrderLifecyclePatch {
  if (TERMINAL_STATUSES.has(order.status)) {
    throw new OrderLifecycleError(`An order in status ${order.status} is terminal.`);
  }
  if (event.eventType !== "order_received" && order.paymentStatus !== "succeeded") {
    throw new OrderLifecycleError("Stripe must confirm payment before provisioning starts.");
  }
  if (event.status === "pending" || event.status === "failed") return {};

  if (event.eventType === "provider_matching" || event.eventType === "contract_generation") {
    const status = advanceStatus(order.status, "processing");
    return status ? { status } : {};
  }

  if (event.eventType === "provisioning") {
    const status = advanceStatus(order.status, "provisioning");
    return {
      ...(status ? { status } : {}),
      ...(order.provisioningStartedAt ? {} : { provisioningStartedAt: now }),
    };
  }

  if (event.eventType === "ready" && event.status === "completed") {
    const status = advanceStatus(order.status, "active");
    return {
      ...(status ? { status } : {}),
      ...(order.provisioningStartedAt ? {} : { provisioningStartedAt: now }),
      ...(order.provisioningCompletedAt ? {} : { provisioningCompletedAt: now }),
    };
  }

  if (event.eventType === "ready") {
    const status = advanceStatus(order.status, "provisioning");
    return {
      ...(status ? { status } : {}),
      ...(order.provisioningStartedAt ? {} : { provisioningStartedAt: now }),
    };
  }

  return {};
}
