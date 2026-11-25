import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "./auth.schemas";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";
import { clearSession, setSession } from "../../lib/auth-store";
import { queryClient } from "../../lib/query-client";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["business_analyst"],
};

function SignOutButton() {
  const { signOut } = useAuth();
  return <button onClick={signOut}>Sign out</button>;
}

describe("AuthProvider", () => {
  afterEach(() => {
    clearSession();
    queryClient.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("clears cached project data when the signed-in session ends", async () => {
    const userActions = userEvent.setup();
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          success: true,
          data: { user },
          requestId: "request-1",
        }),
      ),
    );
    setSession({ accessToken: "test-token", user });
    queryClient.setQueryData(["private", "project"], { name: "Sensitive" });

    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );

    await userActions.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(queryClient.getQueryData(["private", "project"])).toBeUndefined();
    });
  });
});
