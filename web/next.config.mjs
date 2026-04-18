/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true
  },
  async rewrites() {
    const functionsBaseUrl = process.env.FUNCTIONS_BASE_URL || 'http://127.0.0.1:5001';

    return [
      {
        source: '/api/functions/:path*',
        destination: `${functionsBaseUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
