import LoginForm from "@/components/login-form";
import { Suspense } from "react";

export default function page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
