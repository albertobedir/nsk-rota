/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Icons from "./icons";
import Logo from "./logo";
import NavbarModal from "./navbar-modal";
import Search from "./search";
import useSessionStore from "@/store/session-store";
import { auth } from "@/lib/axios/auth";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Zustand cart
  const totalItems = useSessionStore((s) => s.cartTotalItems());
  // Session user (contains credit fields)
  const user = useSessionStore((s) => s.user);

  // Hydration-safe state
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Refresh session on mount so credit values reflect latest server state
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await auth.getSession();
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // hide on scroll: when user scrolls down hide navbar, show when scrolling up
  useEffect(() => {
    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    const onScroll = () => {
      const current = window.scrollY;
      if (current > lastY && current > 80) {
        setHidden(true);
      } else if (current < lastY) {
        setHidden(false);
      }
      lastY = current;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.nav
      initial={false}
      animate={{ y: hidden ? "-100%" : 0 }}
      transition={{ duration: 0.42, ease: [0.2, 0.85, 0.25, 1] }}
      className={cn(
        "sticky top-0 z-50",
        "flex flex-col gap-4 bg-white shadow shadow-accent"
      )}
    >
      <div className="w-full">
        <div className="h-1.5 bg-primary w-full"></div>
        <div className="container relative flex items-center justify-end">
          <Link
            href="/"
            className="
      relative flex items-center justify-center
      rounded-b-md text-white px-30 text-xs font-medium
      max-w-[9.5rem] h-9
      right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-[8%]
    "
          >
            {/* Background */}
            <div className="absolute inset-0">
              <Image
                src="/header-upper-bg-primary.svg"
                alt="logo"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Content */}
            <div className="relative z-10 flex items-center gap-1 px-3">
              <span className="text-sm leading-4 whitespace-nowrap">
                Corporate Website
              </span>
              <Icons width={18} height={18} name="external-link" />
            </div>
          </Link>
        </div>
      </div>

      <div className="pb-11 md:px-20 bg-white z-20">
        <div className="container px-4 relative flex items-center justify-between gap-8 xl:gap-10">
          {/* LOGO */}
          <Link
            className="cursor-pointer w-[110px] sm:w-[140px] md:w-[180px]"
            href="/"
          >
            <Logo className="w-full h-auto md:-mt-4 text-primary" />
          </Link>

          {/* RESPONSIVE SEARCH + CREDIT BAR */}
          <div
            className={cn(
              "lg:relative lg:px-0 px-4 absolute grid grid-cols-6 flex-1 gap-6 items-center justify-center w-full left-0 bottom-0 translate-y-[calc(100%+1.5rem)] lg:left-auto lg:bottom-auto lg:translate-y-0",
              isSearchOpen ? "lg:grid grid" : "lg:grid hidden"
            )}
          >
            <div className="col-span-6 xl:col-span-5 xl:max-w-full w-full justify-center flex relative">
              <Search />

              <button
                className="absolute top-3 right-3 md:hidden p-2"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Close search"
              >
                <Icons name="x" width={20} height={20} />
              </button>
            </div>

            <div className="hidden xl:flex col-span-1 w-full justify-end">
              <div className="bg-white p-1   rounded-xl shadow-md w-[220px]">
                {(() => {
                  const creditLimit = Number(user?.creditLimit ?? 0);
                  const creditUsed = Number(user?.creditUsed ?? 0);
                  const creditRemaining = Number(
                    user?.creditRemaining ??
                      Math.max(0, creditLimit - creditUsed)
                  );
                  const fmt = (v: number) =>
                    new Intl.NumberFormat("tr-TR", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }).format(v) + " $";

                  return (
                    <>
                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Credit</span>
                        <span className="text-slate-600 font-medium">
                          {fmt(creditLimit)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-orange-500 font-semibold">
                          Used
                        </span>
                        <span className="text-orange-500 font-bold">
                          {fmt(creditUsed)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm text-slate-400">
                        <span>Remaining</span>
                        <span className="text-slate-600 font-medium">
                          {fmt(creditRemaining)}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* RIGHT SIDE ICONS */}
          <div className="flex items-center justify-between h-18 gap-5">
            {/* 🛒 CART + BADGE */}
            <Link href="/basket" className="cursor-pointer relative">
              <Icons
                name="shopping-basket"
                strokeWidth={1.3}
                width={36}
                height={36}
              />

              {/* Hydration safe badge */}
              {mounted && totalItems > 0 && (
                <span
                  className="
                           absolute -top-1 -right-1
                           bg-red-600 text-white text-xs
                           w-5 h-5 flex items-center justify-center
                           rounded-full font-bold shadow-md
                           "
                >
                  {totalItems}
                </span>
              )}
            </Link>

            {/* MOBILE SEARCH BUTTON */}
            <button
              className="cursor-pointer md:hidden"
              onClick={() => setIsSearchOpen((s) => !s)}
              aria-expanded={isSearchOpen}
              aria-label={isSearchOpen ? "Close search" : "Open search"}
            >
              <Icons name="search" width={22} height={22} />
            </button>
            {/* MENU BUTTON */}
            <button
              className="cursor-pointer"
              onClick={() => setIsMenuOpen(true)}
            >
              <Icons name="menu" width={36} height={36} />
            </button>
          </div>
        </div>
      </div>

      <NavbarModal open={isMenuOpen} setOpen={setIsMenuOpen} />
    </motion.nav>
  );
}
