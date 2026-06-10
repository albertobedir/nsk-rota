"use client";

import { useEffect, useState } from "react";

export default function Hydrate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true); // client mount olduktan sonra render et
  }, []);

  if (!hydrated) {
    return null; // SSR sırasında DOM üretilmez → hydration mismatch OLMAZ
  }

  return <>{children}</>;
}
