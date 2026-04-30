"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ShoppingBag, Receipt, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { onNavigate?: () => void };

const nav = [
  { label: "My Account", href: "/profile/account", icon: User },

  { label: "Order History", href: "/profile/order-history", icon: Receipt },
  { label: "Invoices", href: "/profile/invoices", icon: Receipt },
];

const bottom = [
  {
    label: "Product Search",
    href: "/products?isFromSearchComp=false",
    icon: ShoppingBag,
  },
];

export default function SidebarNav({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Profile
      </div>

      <nav className="space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-[#fff3e6] text-slate-900 ring-1 ring-[#f28c1a]/30"
                  : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-[#f28c1a]" : "text-slate-500",
                  )}
                />
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
            </Link>
          );
        })}
      </nav>

      <div className="my-3 h-px bg-black/5" />

      <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Products
      </div>

      <nav className="space-y-1">
        {bottom.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center justify-between rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-[#fff3e6] text-slate-900 ring-1 ring-[#f28c1a]/30"
                  : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    active ? "text-[#f28c1a]" : "text-slate-500",
                  )}
                />
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-400" />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
