import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF rendering uses its own React renderer and native font code, so keep it out of the server bundle
  serverExternalPackages: ["@react-pdf/renderer", "exceljs"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-*",
      },
    ],
  },
};

export default nextConfig;
