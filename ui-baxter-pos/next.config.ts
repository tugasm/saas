import type { NextConfig } from "next";

const backendUrl = process.env.API_URL || 'https://ms-baxter-pos-tugasmeilyanto7522-bpwario0.leapcell.dev';
console.log('[next.config] API_URL:', process.env.API_URL);
console.log('[next.config] rewrite destination:', backendUrl);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
