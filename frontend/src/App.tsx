import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { ConfigurationNotice } from "./components/feedback/ConfigurationNotice";
import { AuthProvider } from "./features/auth/AuthProvider";
import { parseFrontendEnv } from "./lib/env";
import { queryClient } from "./lib/query-client";

export default function App() {
  const config = parseFrontendEnv(import.meta.env);

  if (!config.success) {
    return <ConfigurationNotice issues={config.error.issues} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
