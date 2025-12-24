"use client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export default function AddMemberPageClient() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function createUser() {
      const email = searchParams.get("email") || "";
      const firstName = searchParams.get("firstName") || "";
      const lastName = searchParams.get("lastName") || "";

      if (!email || !firstName || !lastName) {
        setMessage("Missing parameters: email, firstName, or lastName");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/add-member", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, firstName, lastName }),
        });

        const data = await response.json();

        if (!response.ok) {
          setMessage(data.message || "Something went wrong");
        } else {
          setMessage(data.message || "User created successfully");
        }
      } catch {
        setMessage("A server error occurred");
      } finally {
        setLoading(false);
      }
    }

    createUser();
  }, [searchParams]);

  return (
    <section className="flex flex-col items-center justify-center min-h-screen p-4">
      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <Spinner />
          <p>Creating member...</p>
        </div>
      ) : (
        <div className="text-center p-5 rounded-lg flex items-center justify-center bg-[#e8e8e8]">
          <p className="mb-4">{message}</p>
        </div>
      )}
    </section>
  );
}
