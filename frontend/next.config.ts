import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable network interface detection to avoid macOS system error
  experimental: {
    skipTrailingSlashRedirect: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*', // Proxy to Express server
      },
    ];
  },
};

export default nextConfig;
