"use client";

import { auth } from "@/lib/axios";
import { useQuery } from "@tanstack/react-query";

function Layout({ children }: { children: React.ReactNode }) {
  // const { isLoading } = useQuery({
  //   queryKey: ["session"],
  //   queryFn: async () => {
  //     const sessionData = await auth.getSession();
  //     return sessionData || {};
  //   },
  // });

  // if (isLoading) {
  //   return <div>Loading...</div>;
  // }

  return <>{children}</>;
}

export default Layout;
