import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/history", destination: "/workspace", permanent: false },
      { source: "/dashboard", destination: "/workspace", permanent: false },
      { source: "/results", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
