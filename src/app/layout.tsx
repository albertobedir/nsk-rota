"use client";
import "./globals.css";
import localFont from "next/font/local";
import Provider from "@/providers";

const mainFont = localFont({
  src: [
    {
      path: "../font/288d6d39ab6e433a3a74.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../font/5e08f16009caa2427e11.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../font/d19e9669110b2ee15190.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../font/08bc9814b263f28f51ae.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../font/60a0e736f57cd5ea2697.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "../font/eb29fcb5375158b894ea.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${mainFont.className} antialiased`}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
