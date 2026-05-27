import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  async redirects() {
    return [
      {
        source: "/getting-started/introduction",
        destination: "/",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
