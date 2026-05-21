import type { NextConfig } from "next";

const AGENT_ORIGIN = "https://denscope-agent-production.up.railway.app";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/:path*",
        destination: `${AGENT_ORIGIN}/:path*`,
        has: [{ type: "host", value: "agent.denscope.xyz" }],
      },
    ];
  },
};

export default nextConfig;
