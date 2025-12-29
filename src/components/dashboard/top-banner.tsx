"use client";
import Image from "next/image";
import { usePathname } from "next/navigation";

export default function TopBanner() {
  const pathname = usePathname() || "/";

  const mapTitle = (p: string) => {
    if (p === "/profile" || p === "/profile/")
      return { title: "My Account", rotaNo: "" };
    if (p.startsWith("/profile/open-orders"))
      return { title: "Open Orders", rotaNo: "" };
    if (p.startsWith("/profile/order-history"))
      return { title: "Order History", rotaNo: "" };
    if (p.startsWith("/profile/invoices"))
      return { title: "Invoices", rotaNo: "" };
    if (p.startsWith("/profile/account-statement"))
      return { title: "Account Statement", rotaNo: "" };
    if (p.startsWith("/profile/payment"))
      return { title: "Payment", rotaNo: "" };
    if (p.startsWith("/profile/wire-transfer"))
      return { title: "Wire Transfer Information", rotaNo: "" };
    if (p.startsWith("/profile/order-history/"))
      return { title: "Order", rotaNo: p.split("/").pop() || "" };
    // fallback for product detail like pages
    if (p.startsWith("/products/") || p.startsWith("/product/"))
      return { title: "Product Detail", rotaNo: p.split("/").pop() || "" };
    return { title: "Profile", rotaNo: "" };
  };

  const { title, rotaNo } = mapTitle(pathname);

  return (
    <div className="bg-[#f3f3f3]  md:flex">
      <div className="w-full max-w-[1540px] flex-col md:flex-row gap-2  px-6 mx-auto flex items-center justify-between py-10">
        <div>
          <h1 className="font-bold text-3xl md:text-4xl">{title}</h1>
          <div className="mt-2 text-sm text-muted-foreground">
            <span>Home</span>
            <span className="px-2 opacity-60">/</span>
            {rotaNo ? (
              <span className="font-semibold">{rotaNo}</span>
            ) : (
              <span className="font-semibold">{title}</span>
            )}
          </div>
        </div>

        <div className="flex items-center">
          <Image
            className="-mt-[1rem]"
            src="/tecdoc.png"
            alt="TecDoc"
            width={160}
            height={44}
          />
        </div>
      </div>
    </div>
  );
}
