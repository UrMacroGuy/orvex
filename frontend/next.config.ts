import type { NextConfig } from "next";
import path from "node:path";

const rootPath = path.join(__dirname, "../");

const nextConfig: NextConfig = {
  outputFileTracingRoot: rootPath,
  turbopack: {
    root: rootPath,
  },
};

export default nextConfig;
