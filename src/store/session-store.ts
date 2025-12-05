import { User } from "@/generated/prisma/client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  user: User | null;
  setUser: (user: User) => void;
  clearSession: () => void;
}

const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,

      setUser: (user) => set({ user }),
      clearSession: () => set({ user: null }),
    }),
    { name: "session-storage" }
  )
);

export default useSessionStore;
