"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Api } from "@/lib/axios/instance";
import useSessionStore from "@/store/session-store";

/**
 * Mounts invisibly in the (main) layout.
 * On every mount it checks the session. If the server responds with 401
 * or returns no user, it nukes local state (zustand/localStorage) and all
 * auth cookies (via the /api/auth/logout endpoint), then sends the user to
 * the login page.
 *
 * The axios interceptor already handles mid-request 401s (token refresh →
 * redirect). This guard covers the initial "did we actually have a valid
 * session when the page loaded?" scenario.
 */
export default function SessionGuard() {
  const router = useRouter();
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    const verify = async () => {
      try {
        const res = await Api.get("/auth/get-session", { _retry: true }); // _retry: true → skip interceptor's auto-refresh so we control the flow here

        if (res.status === 401 || !res.data?.user) {
          await purgeAndRedirect(clearSession, router);
        }
      } catch {
        await purgeAndRedirect(clearSession, router);
      }
    };

    verify();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

async function purgeAndRedirect(
  clearSession: () => void,
  router: ReturnType<typeof useRouter>,
) {
  // 1. Clear zustand store (removes persisted data from localStorage)
  clearSession();

  // 2. Clear all httpOnly auth cookies via server route
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // non-fatal — cookies will expire naturally
  }

  // 3. Redirect to login
  router.replace("/auth/login");
}
