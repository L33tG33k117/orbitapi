import type { NextConfig } from "next";

// The self-hosted package needs a different build shape from the cloud one.
// This is the only place that differs at BUILD time; everything else keys off
// ORBIT_EDITION at runtime (see lib/edition.ts).
const selfHost = process.env.ORBIT_EDITION === 'selfhost'

const nextConfig: NextConfig = {
  // 'standalone' emits a self-contained server with only the node_modules it
  // actually uses, which is what makes the Docker image shippable rather than
  // a copy of the whole repo. Cloud keeps Vercel's default output.
  ...(selfHost ? { output: 'standalone' as const } : {}),

  images: {
    // Next's image optimizer shells out to a native binary and wants to fetch
    // and cache remote images — neither is a good fit for an air-gapped box.
    // Serve images as-is there.
    ...(selfHost ? { unoptimized: true } : {}),
  },
};

export default nextConfig;
