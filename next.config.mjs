/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // อนุญาตอัปโหลดรูปขนาดใหญ่ผ่าน Server Actions / route handlers
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
