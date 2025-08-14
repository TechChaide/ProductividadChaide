import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  //output: "standalone",
 //basePath: "/notificacion-produccion",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      // {
      //   source: '/',
      //   destination: '/login',
      //   permanent: true,
      // },
    ];
  },
  images: {
    // Le dice al optimizador de imágenes de Next.js que los recursos
    // se servirán desde esta ruta, incluyendo el basePath.
    //unoptimized: true,
    path: "/notificacion-produccion/_next/image",
    // remotePatterns: [
    //   {
    //     protocol: 'http',
    //     hostname: '192.168.7.214',
    //     port: '',
    //     pathname: '/Evolution/fotos/**',
    //   },
    // ],
  },
};

export default nextConfig;
