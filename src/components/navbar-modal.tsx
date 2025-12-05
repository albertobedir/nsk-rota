"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";

interface Props {
   open: boolean;
   setOpen: (open: boolean) => void;
}

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
         <div
            className={cn(
               "fixed inset-0 z-20 transition-opacity duration-300",
               open
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
            )}
            onClick={() => setOpen(false)}
         />
         <div
            ref={modalRef}
            className={cn(
               "absolute bottom-0 w-full translate-y-full bg-red-400 z-30 transition-transform duration-300 ease-in-out",
               open ? "flex" : "hidden"
            )}
         >
            navbar-modal
         </div>
      </>
   );
}
