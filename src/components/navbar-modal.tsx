"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSessionStore from "@/store/session-store";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface MenuItem {
  name: string;
  href: string;
  desktop?: boolean;
}

interface Category {
  name: string;
  items: MenuItem[];
}

const categories: Category[] = [
  {
    name: "Profile",
    items: [
      { name: "My Account", href: "/profile/account" },

      { name: "Order History", href: "/profile/order-history" },
      { name: "Invoices", href: "/profile/invoices" },
      { name: "Logout", href: "/logout", desktop: true },
    ],
  },
  {
    name: "Products",
    items: [
      { name: "Product Search", href: "/products?isFromSearchComp=false" },
    ],
  },
];

export default function NavbarModal({ open, setOpen }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const clearSession = useSessionStore((s) => s.clearSession);

  const fmt = (v: number) =>
    new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v) + " $";

  // No document-level outside-click listener: we only close the menu
  // when a menu item is clicked (per requested behavior).

  return (
    <>
      {/* Mobile: use shadcn Sheet for better responsive UX */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="sm:hidden"
          overlayClassName="hidden"
        >
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-1 gap-6 items-start py-4 px-4">
            {categories.map((category) => (
              <div key={category.name} className="w-full">
                <h4 className="text-lg font-semibold pb-2">{category.name}</h4>
                <ul className="flex flex-col">
                  {category.items
                    .filter((item) => !item.desktop)
                    .map((item) => (
                      <li key={item.name} className="text-base py-2">
                        <Link
                          className="hover:text-secondary transition-colors"
                          href={item.href}
                          onClick={() => {
                            localStorage.setItem("isFromSearchComp", "false");
                            setOpen(false);
                          }}
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            ))}

            {/* USER CREDIT INFO - Mobile */}
            {user ? (
              <div className="w-full border-t border-slate-100 pt-4 mt-2">
                <h4 className="text-lg font-semibold pb-3">Credit Info</h4>
                <div className="bg-slate-50 px-3 py-3 rounded-lg border border-slate-100">
                  {(() => {
                    const creditLimit = Number(user?.creditLimit ?? 0);
                    const creditUsed = Number(user?.creditUsed ?? 0);
                    const creditRemaining = Number(
                      user?.creditRemaining ??
                        Math.max(0, creditLimit - creditUsed),
                    );

                    return (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <span className="text-slate-500 font-medium">
                          Credit Limit
                        </span>
                        <span className="text-slate-700 font-semibold text-right tabular-nums">
                          {fmt(creditLimit)}
                        </span>

                        <span className="text-amber-600 font-medium">Used</span>
                        <span className="text-amber-600 font-semibold text-right tabular-nums">
                          {fmt(creditUsed)}
                        </span>

                        <span className="text-slate-500 font-medium">
                          Remaining
                        </span>
                        <span className="text-slate-700 font-semibold text-right tabular-nums">
                          {fmt(creditRemaining)}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : null}

            {/* Logout - Mobile only, below Credit Info */}
            {user && (
              <div className="w-full border-t border-slate-100 pt-4">
                <Link
                  href="/logout"
                  onClick={() => setOpen(false)}
                  className="text-base py-2 text-red-600 font-semibold hover:text-red-700 transition-colors block"
                >
                  Logout
                </Link>
              </div>
            )}
          </div>

          {/* top-right X provided by SheetContent */}
        </SheetContent>
      </Sheet>

      {/* Desktop/tablet: keep animated panel but hide on small screens */}
      <AnimatePresence>
        {open && (
          <div
            className="hidden sm:block"
            onClickCapture={(e) => e.stopPropagation()}
            onMouseDownCapture={(e) => e.stopPropagation()}
            onPointerDownCapture={(e) => e.stopPropagation()}
          >
            <motion.div
              key="panel"
              ref={modalRef}
              initial={{ y: "20%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "20%", opacity: 0 }}
              transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
              className={cn(
                "absolute bottom-0 w-full items-start justify-center bg-white z-30 pointer-events-auto",
                "sm:bottom-auto sm:top-[170px]",
                "hidden sm:flex",
              )}
            >
              <div className="grid grid-cols-4 gap-4 items-start py-6 px-6 max-w-[1200px] w-full">
                {categories.map((category) => (
                  <div key={category.name}>
                    <h3 className="text-xl font-bold py-2">{category.name}</h3>
                    <ul className="flex flex-col">
                      {category.items.map((item) => (
                        <li key={item.name} className="text-base py-1">
                          <Link
                            className={cn(
                              "hover:text-secondary transition-colors",
                              item.name === "Logout" &&
                                "text-red-600 font-semibold hover:text-red-700",
                            )}
                            href={item.href}
                            onClick={() => {
                              localStorage.setItem("isFromSearchComp", "false");
                            }}
                          >
                            {item.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
