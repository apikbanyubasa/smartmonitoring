/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
