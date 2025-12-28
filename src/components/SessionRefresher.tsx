"use client";

import { useEffect } from "react";
import { auth } from "@/lib/axios/auth";
import useSessionStore from "@/store/session-store";

export default function SessionRefresher() {
  useEffect(() => {
    // If there's already a user in the client session store, skip refresh
    const current = useSessionStore.getState().user;
    if (current) return;

    (async () => {
      try {
        await auth.getSession();
        console.debug("SessionRefresher: session refreshed");
      } catch (e) {
        console.debug("SessionRefresher: failed to refresh session", e);
      }
    })();
  }, []);

  return null;
}
