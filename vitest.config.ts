export default {
  test: {
    environment: "jsdom",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "app/house/page.tsx",
        "app/townhouse/page.tsx",
        "app/api/capture-intent/route.ts",
        "app/api/submit-appraisal/route.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      reporter: ["text", "text-summary"],
    },
  },
};
