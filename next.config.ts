import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Les images (logo, courbe de Gauss) sont envoyées en base64 dans les
    // actions serveur ; la limite par défaut de 1 Mo est trop basse.
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
