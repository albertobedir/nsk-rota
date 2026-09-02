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

  useEffect(() => {
    let mounted = true;

    if (useSessionStore.getState().user) {
      setReady(true);
    }

    auth
      .getSession()
      .then((data) => {
        if (!mounted) return;
        if (!data?.user && !useSessionStore.getState().user) {
          router.replace("/auth/login");
          return;
        }
        setReady(true);
      })
      .catch(() => {
        if (!mounted) return;
        if (useSessionStore.getState().user) {
          setReady(true);
          return;
        }
        router.replace("/auth/login");
      });

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner size={48} label="Loading session..." />
      </div>
    );
  }

  return <>{children}</>;
}
