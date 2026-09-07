import { trpc } from "@/lib/trpc";
import { clearCheckoutIntent } from "@/lib/checkoutIntent";
import { clearAllLeadClaims } from "@/lib/leadClaim";
import { useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { getQueryKey } from "@trpc/react-query";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/login" } =
    options ?? {};
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation();

  const clearAuthenticatedState = useCallback(async () => {
    // Stop in-flight protected requests before removing their cached payloads.
    await queryClient.cancelQueries();

    // Keep only an explicit anonymous auth result so mounted guards update
    // immediately; every other query and all mutation results are discarded.
    utils.auth.me.setData(undefined, null);
    const authQueryKey = getQueryKey(trpc.auth.me, undefined, "query");
    const authQuery = queryClient
      .getQueryCache()
      .find({ queryKey: authQueryKey, exact: true });
    queryClient.removeQueries({ predicate: query => query !== authQuery });
    queryClient.getMutationCache().clear();

    clearCheckoutIntent();
    clearAllLeadClaims();
  }, [queryClient, utils]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        // The server already considers this browser signed out.
      } else {
        // Preserve the authenticated UI and its data when the request may not
        // have reached the server (offline, timeout, or transient failure).
        throw error;
      }
    }

    await clearAuthenticatedState();
  }, [clearAuthenticatedState, logoutMutation]);

  const state = useMemo(() => {
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
