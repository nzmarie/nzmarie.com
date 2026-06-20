import type { NextConfig } from "next";

const isTurbo = process.argv.includes("--turbo") || process.argv.includes("--turbopack");

const nextConfig: NextConfig = {
  ...(isTurbo ? {} : {
    webpack: (config) => {
      config.module.exprContextCritical = false;
      return config;
    },
  }),
  async redirects() {
    return [
      {
        source: "/appraisal",
        destination: "/#appraisal",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
