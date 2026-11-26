import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.VITE_API_BASE_URL;
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || "http://localhost:3000";

  return {
    plugins: [react()],
    server: {
      proxy:
        apiBaseUrl?.startsWith("/") && !apiBaseUrl.startsWith("//")
          ? {
              [apiBaseUrl]: {
                target: apiProxyTarget,
                changeOrigin: true,
              },
            }
          : undefined,
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  };
});
