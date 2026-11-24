import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../../features/auth/AuthProvider";
import type { AuthUser } from "../../features/auth/auth.schemas";
import { clearSession, setSession } from "../../lib/auth-store";
import { AppShell } from "./AppShell";

function renderProjectShell(user: AuthUser) {
  setSession({ accessToken: "test-token", user });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: { user },
        requestId: "request-7",
      }),
    ),
  );

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/app/projects/project-1"]}>
        <Routes>
          <Route path="/app/projects/:projectId" element={<AppShell />}>
            <Route index element={<p>Project overview content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("AppShell role-aware navigation", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    clearSession();
  });

  afterEach(() => {
    clearSession();
    window.localStorage.removeItem("clarity-theme");
    document.documentElement.removeAttribute("data-theme");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hides approvals navigation from a standard user", async () => {
    renderProjectShell({
      id: "user-1",
      email: "analyst@example.com",
      roles: ["business_analyst"],
    });

    expect(
      await screen.findByText("Project overview content"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Approvals" }),
    ).not.toBeInTheDocument();
  });

  it("shows approvals navigation to a Product Owner", async () => {
    renderProjectShell({
      id: "reviewer-1",
      email: "reviewer@example.com",
      roles: ["product_owner"],
    });

    expect(
      await screen.findByRole("link", { name: "Approvals" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Delivery reviews" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Documents" }),
    ).toBeInTheDocument();
  });

  it("shows Delivery Lead tools without business approvals or authoring links", async () => {
    renderProjectShell({
      id: "delivery-1",
      email: "delivery@example.com",
      roles: ["delivery_lead"],
    });

    expect(
      await screen.findByRole("link", { name: "Delivery reviews" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Approvals" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Documents" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "AI workflows" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Exports" }),
    ).not.toBeInTheDocument();
  });

  it("keeps administrator navigation isolated for legacy mixed-role sessions", async () => {
    renderProjectShell({
      id: "admin-1",
      email: "admin@example.com",
      roles: ["admin", "business_analyst"],
    });

    expect(
      await screen.findByRole("link", { name: "Administration" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Projects" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Current project")).not.toBeInTheDocument();
  });

  it("toggles and persists the color theme", async () => {
    renderProjectShell({
      id: "reviewer-1",
      email: "reviewer@example.com",
      roles: ["product_owner"],
    });

    const darkModeButton = await screen.findByRole("button", {
      name: "Switch to dark mode",
    });
    fireEvent.click(darkModeButton);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("clarity-theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem("clarity-theme")).toBe("light");
  });
});
