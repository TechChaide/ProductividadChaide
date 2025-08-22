import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  //basePath: '/NotificacionProduccion',
  //basePath: "/NotificacionProduccion",
  // images: {
    // path: "/NotificacionProduccion/_next/image",
  // },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;