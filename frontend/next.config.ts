import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        /**
         * Proxy all /api/backend/* requests to the FastAPI server.
         * This eliminates CORS issues entirely in development.
         *
         * Frontend calls:  /api/backend/execute-workflow
         * Proxied to:      http://localhost:8000/api/v1/execute-workflow
         */
        source: "/api/backend/:path*",
        destination: "http://localhost:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
