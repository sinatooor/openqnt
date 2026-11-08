import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config";

// Only the web app's unit tests run here. Playwright specs live in e2e/, and
// orchestrator/ and services/ have their own test runners.
export default defineConfig((env) =>
  mergeConfig(viteConfig(env), {
    test: {
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
    },
  }),
);
