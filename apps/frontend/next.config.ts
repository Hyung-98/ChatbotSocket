import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',
    MOBILE_BACKEND_URL: process.env.MOBILE_BACKEND_URL || 'http://192.168.1.97:3001',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'your-secret-key-here',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },
};

export default nextConfig;
