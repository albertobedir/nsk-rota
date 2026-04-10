import QueryProvider from "./tanstack.provider";
import { Toaster } from "@/components/ui/sonner";

function Provider({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <Toaster />
    </QueryProvider>
  );
}

export default Provider;
