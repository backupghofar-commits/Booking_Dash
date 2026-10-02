import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['*'],
  serverExternalPackages: ['better-sqlite3', 'bcryptjs'],
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;
