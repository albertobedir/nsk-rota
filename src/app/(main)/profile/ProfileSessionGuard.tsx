"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/axios/auth";
import useSessionStore from "@/store/session-store";
import { Spinner } from "@/components/ui/spinner";

export default function ProfileSessionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    // If zustand/persist already has a user hydrated, skip the fetch
    if (user) {
      setReady(true);
      return;
    }

    let mounted = true;
    auth
      .getSession()
      .then((data) => {
        if (!mounted) return;
        if (!data?.user) {
          router.replace("/auth/login");
        } else {
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted) router.replace("/auth/login");
      });

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size={48} label="Loading session..." />
      </div>
    );
  }

  return <>{children}</>;
}
