import type { NextConfig } from "next";

/**
 * The `agent.denscope.xyz` host-based rewrite was removed (SEC-10).
 *
 * It proxied `/:path*` to a Railway origin that returns
 * `404 Application not found`, for a hostname that is NXDOMAIN. Nothing could
 * reach it, so removing it changes no behaviour — but a blanket wildcard rewrite
 * to a dead third-party origin is a takeover-shaped hazard the moment that
 * hostname is pointed anywhere, and the service it fronted (an LLM endpoint
 * behind a fixed x402 price) is deliberately not coming back in that shape.
 *
 * If the agent is ever redeployed, reintroduce the rewrite together with the
 * DNS record, not ahead of it.
 */
const nextConfig: NextConfig = {};

export default nextConfig;
