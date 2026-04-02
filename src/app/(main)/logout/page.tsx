"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSessionStore from "@/store/session-store";

export default function LogoutPage() {
  const router = useRouter();
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    const handleLogout = async () => {
      try {
        // Call logout API to clear cookies server-side
        await fetch("/api/auth/logout", { method: "POST" });

        // Clear localStorage
        localStorage.clear();

        // Clear session store
        clearSession();
      } catch (e) {
        console.error("Logout failed:", e);
      } finally {
        // Redirect to login page
        router.push("/auth/login");
      }
    };

    handleLogout();
  }, [router, clearSession]);

  return <div></div>;
}
