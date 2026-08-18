import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client'],
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
