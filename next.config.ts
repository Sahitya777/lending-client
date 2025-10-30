/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config: { resolve: { fallback: any; alias: any; }; }, { isServer }: any) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Handle rpc-websockets module resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      'rpc-websockets/dist/lib/client/websocket': 'rpc-websockets',
    };
    
    return config;
  },
};

module.exports = nextConfig;