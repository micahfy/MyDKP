/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // 启用压缩
  compress: true,
  
  // 优化图片
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30天
  },
  
  // 生产环境优化
  productionBrowserSourceMaps: false,
  
  // 输出配置
  output: 'standalone',
  
  // 实验性功能
  experimental: {
    // 优化包大小
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  
  // Headers 配置
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
        ],
      },
      // 静态资源缓存
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API 响应缓存
      {
        source: '/api/teams',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120',
          },
        ],
      },
      {
        source: '/api/players',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=30, stale-while-revalidate=60',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;