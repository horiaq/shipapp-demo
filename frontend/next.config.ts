import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // Backend runs on port 3000 in dev, port 3001 in production
    const backendPort = process.env.NODE_ENV === 'production' ? 3001 : 3000;
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${backendPort}/api/:path*`, // Proxy to Express server
      },
    ];
  },
};

export default nextConfig;
