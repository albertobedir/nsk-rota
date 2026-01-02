"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";

interface Props {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const categories = [
  {
    name: "Profile",
    items: [
      { name: "My Account", href: "/profile/account" },
      { name: "Open Orders", href: "/profile/open-orders" },
      { name: "Order History", href: "/profile/order-history" },
      { name: "Invoices", href: "/profile/invoices" },

      { name: "Payment", href: "/profile/payment" },
    ],
  },
  {
    name: "Products",
    items: [{ name: "Product Search", href: "/products" }],
  },
];

export default function NavbarModal({ open, setOpen }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, setOpen]);

  return (
    <>
      {/* Mobile: use shadcn Sheet for better responsive UX */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:hidden" overlayClassName="sm:hidden">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-1 gap-6 items-start py-4 px-4">
            {categories.map((category) => (
              <div key={category.name} className="w-full">
                <h4 className="text-lg font-semibold pb-2">{category.name}</h4>
                <ul className="flex flex-col">
                  {category.items.map((item) => (
                    <li key={item.name} className="text-base py-2">
                      <Link
                        className="hover:text-secondary transition-colors"
                        href={item.href}
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* top-right X provided by SheetContent */}
        </SheetContent>
      </Sheet>

      {/* Desktop/tablet: keep animated panel but hide on small screens */}
      <AnimatePresence>
        {open && (
          <>
            {/* no overlay on desktop: click-outside is handled via document listener */}

            <motion.div
              key="panel"
              ref={modalRef}
              initial={{ y: "20%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "20%", opacity: 0 }}
              transition={{ duration: 0.36, ease: [0.2, 0.8, 0.2, 1] }}
              className={cn(
                "hidden sm:flex absolute bottom-0 w-full items-start justify-center bg-white z-30",
                "sm:bottom-auto sm:top-[170px]"
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
                            className="hover:text-secondary transition-colors"
                            href={item.href}
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
          </>
        )}
      </AnimatePresence>
    </>
  );
}
