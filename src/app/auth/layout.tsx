"use client";
import Logo from "@/components/icons/logo";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import React from "react";

const footerLinks = [
  {
    name: "Çerez Politikası",
    href: "https://nskgroup.com.tr/tr/cerez-politikasi",
  },
  {
    name: "Gizlilik Politikası",
    href: "https://nskgroup.com.tr/tr/gizlilik-politikasi",
  },
  {
    name: "KVKK Aydınlatma Metni",
    href: "https://nskgroup.com.tr/tr/kvkk-aydinlatma-metni",
  },
];

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex flex-col min-h-screen bg-fixed bg-center bg-cover bg-no-repeat bg-amber-50 md:bg-[url('/auth-layout-bg.webp')]">
      <div className="flex-1">{children}</div>

      <footer className="bg-white items-center md:items-start flex flex-col gap-4 py-4 px-3 md:px-[7rem] md:pt-[5rem]">
        <Logo size={0.8} className="text-muted-foreground" />

        <Separator className="hidden md:block h-[0.1rem] w-full rounded-full bg-muted-foreground opacity-50" />

        <nav className="flex flex-col md:w-f md:flex-row justify-center md:items-center md:gap-0 gap-3 text-center">
          <ul className="flex justify-center md:justify-start text-sm gap-3 text-muted-foreground items-center flex-wrap flex-1">
            {footerLinks.map((item, i) => (
              <li key={i}>
                <Link
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>

          <span className="text-muted-foreground text-sm">
            © 2022 NSK Group, tüm hakları saklıdır.
          </span>

          <Link
            href="https://babel.com.tr/en"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground sm:flex-1 text-sm md:text-end"
          >
            <span className="hover:text-foreground">
              made by <span className="font-bold">BABEL</span>
            </span>
          </Link>
        </nav>
      </footer>
    </main>
  );
}

export default Layout;
