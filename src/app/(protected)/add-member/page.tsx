"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export default function AddMemberPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    async function createUser() {
      const email = searchParams.get("email") || "";
      const firstName = searchParams.get("firstName") || "";
      const lastName = searchParams.get("lastName") || "";

      if (!email || !firstName || !lastName) {
        setMessage("Eksik parametreler: email, firstName veya lastName yok");
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
          setMessage(data.message || "Bir hata oluştu");
        } else {
          setMessage(data.message || "Kullanıcı başarıyla oluşturuldu");
        }
      } catch {
        setMessage("Sunucu hatası oluştu");
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
          <p>Üye oluşturuluyor...</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="mb-4">{message}</p>
          <a
            href="/auth/login"
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/80"
          >
            Login sayfasına git
          </a>
        </div>
      )}
    </section>
  );
}
