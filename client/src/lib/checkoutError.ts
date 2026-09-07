export type CheckoutErrorAction =
  | "retry"
  | "results"
  | "new-request"
  | "login"
  | "reload";

export interface CheckoutErrorPresentation {
  message: string;
  action?: CheckoutErrorAction;
  actionLabel?: string;
  resetIdempotencyKey?: boolean;
}

function readErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const data = (error as { data?: unknown }).data;
  if (!data || typeof data !== "object") return undefined;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function readErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}

/**
 * Translate the stable information exposed by the current tRPC contract into
 * an actionable checkout message. Unknown server text deliberately falls back
 * to a generic message instead of being displayed verbatim.
 */
export function describeCheckoutError(
  error: unknown
): CheckoutErrorPresentation {
  const code = readErrorCode(error);
  const message = readErrorMessage(error);

  if (code === "UNAUTHORIZED") {
    return {
      message:
        "Votre session a expiré. Reconnectez-vous avant de reprendre le paiement.",
      action: "login",
      actionLabel: "Se reconnecter",
    };
  }

  if (code === "NOT_FOUND") {
    return {
      message:
        "La demande ou l'offre associée n'est plus accessible. Recréez une demande avant tout paiement.",
      action: "new-request",
      actionLabel: "Nouvelle demande",
    };
  }

  if (code === "SERVICE_UNAVAILABLE") {
    return {
      message:
        "Le service de paiement est temporairement indisponible. Aucun paiement n'a été lancé.",
      action: "retry",
      actionLabel: "Réessayer",
    };
  }

  if (code === "TOO_MANY_REQUESTS") {
    return {
      message:
        "Trop de tentatives ont été effectuées. Attendez une minute avant de relancer le paiement.",
    };
  }

  if (code === "BAD_REQUEST") {
    return {
      message:
        "Cette page n'est plus compatible avec les conditions en vigueur. Rechargez-la avant de poursuivre.",
      action: "reload",
      actionLabel: "Recharger la page",
    };
  }

  if (code === "CONFLICT") {
    if (message.includes("Checkout Session is no longer payable")) {
      return {
        message:
          "La session Stripe précédente a expiré. Une nouvelle tentative utilisera une nouvelle session.",
        action: "retry",
        actionLabel: "Créer une nouvelle session",
        resetIdempotencyKey: true,
      };
    }

    if (message.includes("idempotency key is already bound")) {
      return {
        message:
          "Cette tentative est liée à une autre commande. Une nouvelle tentative sécurisée est nécessaire.",
        action: "retry",
        actionLabel: "Nouvelle tentative",
        resetIdempotencyKey: true,
      };
    }

    if (
      message.includes("offer is no longer available") ||
      message.includes("Offer supplier is not assigned")
    ) {
      return {
        message:
          "Cette offre ne peut plus être commandée ou son fournisseur n'est plus confirmé. Choisissez une autre offre.",
        action: "results",
        actionLabel: "Voir les autres offres",
      };
    }

    if (
      message.includes("lead in status converted") ||
      message.includes("lead in status rejected")
    ) {
      return {
        message:
          "Cette demande est déjà finalisée ou clôturée et ne peut pas créer une nouvelle commande.",
        action: "new-request",
        actionLabel: "Nouvelle demande",
      };
    }

    return {
      message:
        "L'état de cette demande n'autorise pas le paiement. Revenez aux résultats avant de réessayer.",
      action: "results",
      actionLabel: "Retour aux résultats",
    };
  }

  return {
    message:
      "Le paiement n'a pas pu démarrer. Aucun débit n'a été confirmé ; vérifiez votre connexion puis réessayez.",
    action: "retry",
    actionLabel: "Réessayer",
  };
}
