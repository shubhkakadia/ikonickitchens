/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["localhost", "192.168.1.200"],
  },
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
