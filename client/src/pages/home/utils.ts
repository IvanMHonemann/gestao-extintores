import { TRPCClientError } from "@trpc/client";

/** Detecta falha de rede / offline para cair no caminho local com segurança. */
export function isOfflineFailure(error: unknown, isOnline: boolean) {
  if (!isOnline) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";

  if (/network|fetch|failed to fetch|load failed|offline|timeout|ECONN|ENOTFOUND|ERR_INTERNET|ERR_NETWORK|aborted|unavailable/i.test(message)) {
    return true;
  }

  if (error instanceof TRPCClientError) {
    const code = (error.data as { code?: string } | undefined)?.code;
    if (
      code === "TIMEOUT" ||
      code === "INTERNAL_SERVER_ERROR" ||
      code === "CLIENT_CLOSED_REQUEST" ||
      code === "BAD_GATEWAY" ||
      code === "SERVICE_UNAVAILABLE" ||
      code === "GATEWAY_TIMEOUT"
    ) {
      return true;
    }
    if (/network|fetch|timeout/i.test(error.message)) return true;
  }

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return true;

  return false;
}
