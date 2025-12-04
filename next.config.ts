import type { NextConfig } from "next";
import { environment } from '@/environments/environments.prod';

const basePath = environment.basePath || '';

const nextConfig: NextConfig = {
  output: "standalone",
  //basePath: basePath,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;