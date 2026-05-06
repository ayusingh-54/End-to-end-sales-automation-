/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
  },
  // Workspace packages ship pre-built JS via their `exports` field; do NOT
  // transpilePackages — that would bypass `exports` and try to read the
  // packages' source `.ts` files (which use NodeNext `.js` import suffixes).
  async redirects() {
    // Forgiving aliases for common singular/plural mistypes.
    return [
      { source: '/log', destination: '/logs', permanent: false },
      { source: '/lead', destination: '/leads', permanent: false },
      { source: '/school', destination: '/schools', permanent: false },
      { source: '/program', destination: '/programs', permanent: false },
      { source: '/campaign', destination: '/campaigns', permanent: false },
      { source: '/template', destination: '/templates', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
