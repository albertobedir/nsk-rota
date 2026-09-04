import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit", "sharp"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
      },
    ],
    dangerouslyAllowSVG: true,
    unoptimized: true,
  },

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.rota-usa.com",
          },
        ],
        destination: "https://rota-usa.com/:path*",
        permanent: true, // 308 redirect
      },
      {
        source: "/invoice",
        destination: "/profile/invoices",
        permanent: false,
      },
      {
        source: "/invoices",
        destination: "/profile/invoices",
        permanent: false,
      },
      {
        source: "/order-history",
        destination: "/profile/order-history",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
