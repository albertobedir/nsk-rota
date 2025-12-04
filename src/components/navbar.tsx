"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import Icons from "./icons";
import Logo from "./logo";
import NavbarModal from "./navbar-modal";
import Search from "./search";

export default function Navbar() {
   const [isOpen, setIsOpen] = useState(false);

   return (
      <nav className="relative flex flex-col gap-4 bg-white shadow shadow-accent z-50">
         <div className="w-full">
            <div className="h-1.5 bg-primary w-full"></div>
            <div className="container relative flex items-center justify-end">
               <Link
                  className="rounded-b-lg text-white text-sm font-medium flex max-w-48 justify-center relative right-[18%]"
                  href="/"
               >
                  <div className="absolute top-0 h-full aspect-90/16">
                     <Image
                        src="/header-upper-bg-primary.svg"
                        alt="logo"
                        width={800}
                        height={60}
                        className="h-full object-cover"
                     />
                  </div>
                  <div className="relative z-10 -top-1.5 flex items-center px-4 pt-1.5">
                     <span className="text-xl leading-6 max-w-28">
                        Corporate Website
                     </span>
                     <Icons width={28} height={28} name="external-link" />
                  </div>
               </Link>
            </div>
         </div>
         <div className="pb-11 bg-white z-20">
            <div className="container flex items-center justify-between gap-10">
               <Link className="cursor-pointer max-w-56 w-full" href="/">
                  <Logo className="max-w-52 text-primary" />
               </Link>
               <div className="grid grid-cols-6 flex-1 gap-6 items-center">
                  <div className="col-span-4">
                     <Search />
                  </div>
                  <div className="col-span-2 h-18 flex items-center justify-between gap-2 p-4 py-3 shadow-[0px_0px_20px_0px_#000] shadow-muted-foreground/30 rounded-xl">
                     <div className="flex flex-col flex-1 text-base">
                        <b className="text-secondary">Remaining Credit</b>
                        <b>$ 1,800</b>
                     </div>
                     <div className="flex flex-col gap-1 w-0.5 h-full mr-2">
                        <div className="w-full aspect-square bg-black/25 rounded-full"></div>
                        <div className="w-full flex-1 bg-black/25 rounded-full"></div>
                        <div className="w-full aspect-square bg-black/25 rounded-full"></div>
                     </div>
                     <div className="flex flex-col flex-1 text-base">
                        <b className="text-secondary">Used Credit</b>
                        <b>$ 8,200</b>
                     </div>
                  </div>
               </div>
               <div className="flex items-center justify-between h-18 gap-5">
                  <Link href="/basket" className="cursor-pointer">
                     <Icons
                        name="shopping-basket"
                        strokeWidth={1.3}
                        width={36}
                        height={36}
                     />
                  </Link>
                  <select className="h-18 outline-none text-xl cursor-pointer">
                     <option value="1">TR</option>
                     <option value="2">EN</option>
                     <option value="3">DE</option>
                     <option value="4">FR</option>
                     <option value="5">IT</option>
                     <option value="6">ES</option>
                     <option value="7">PT</option>
                     <option value="8">NL</option>
                     <option value="9">PL</option>
                     <option value="10">RO</option>
                     <option value="11">BG</option>
                  </select>
                  <button
                     className="cursor-pointer"
                     onClick={() => setIsOpen(true)}
                  >
                     <Icons name="menu" width={36} height={36} />
                  </button>
               </div>
            </div>
         </div>
         <NavbarModal open={isOpen} setOpen={setIsOpen} />
      </nav>
   );
}
