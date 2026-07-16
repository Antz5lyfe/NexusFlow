import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    /**
     * Proxy all /api/backend/* requests to the FastAPI server.
     *
     * BACKEND_URL lets a deployed frontend (e.g. Vercel) point at a hosted
     * backend; it falls back to the local dev server when unset, so nothing
     * changes for `npm run dev`.
     *
     *   Frontend calls:  /api/backend/execute-workflow
     *   Proxied to:      ${BACKEND_URL}/api/v1/execute-workflow
     */
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
