import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use webpack for WASM support (Privacy.cash SDK)
  // Turbopack doesn't fully support WASM yet
  turbopack: {},

  // Externalize Privacy.cash SDK for server-side (runs in Node.js, not webpack)
  serverExternalPackages: ['privacycash', '@lightprotocol/hasher.rs'],

  webpack: (config, { isServer }) => {
    // Enable WASM support for client-side
    if (!isServer) {
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
        layers: true,
      };

      config.module.rules.push({
        test: /\.wasm$/,
        type: 'webassembly/async',
      });
    }

    return config;
  },
};

export default nextConfig;
