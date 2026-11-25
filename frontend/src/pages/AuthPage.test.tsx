import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthProvider";
import { AuthPage } from "./AuthPage";

describe("AuthPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses AIVA branding and links back to the public landing page", () => {
    render(
      <AuthProvider>
        <MemoryRouter>
          <AuthPage mode="login" />
        </MemoryRouter>
      </AuthProvider>,
    );

    expect(
      screen.getByRole("link", { name: "AIVA — AI Virtual Analyst home" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: "Back to AIVA home" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByText("New to AIVA?")).toBeInTheDocument();
  });

  it("shows a confirmation error without sending invalid credentials", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AuthProvider>
        <MemoryRouter>
          <AuthPage mode="register" />
        </MemoryRouter>
      </AuthProvider>,
    );

    await user.type(
      screen.getByLabelText("Business email"),
      "analyst@example.com",
    );
    await user.type(screen.getByLabelText("Password"), "valid-password-123");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "different-password-123",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  }, 10000);
});
