import AddMemberPageClient from "@/components/AddMemberPageClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AddMemberPageClient />
    </Suspense>
  );
}
