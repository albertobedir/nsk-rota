import SubscribeForm from "@/components/subscribe-form";
import { Suspense } from "react";

export default function page() {
  return (
    <Suspense>
      <SubscribeForm />
    </Suspense>
  );
}
