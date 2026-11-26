import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "../../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../../pages/ResetPasswordPage";

describe("password recovery pages", () => {
  it("renders a generic forgot-password confirmation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      Response.json({
        success: true,
        data: { message: "If an account exists for this email address, a password-reset link will be sent." },
        requestId: "reset-request",
      }),
    ));
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    render(
      <MemoryRouter initialEntries={["/forgot-password"]}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.setup().type(
      screen.getByLabelText("Business email"),
      "known@example.test",
    );
    await userEvent.setup().click(
      screen.getByRole("button", { name: "Send reset link" }),
    );
    expect(
      await screen.findByText(/if an account exists/i),
    ).toBeInTheDocument();
  });

  it("rejects mismatched new passwords", async () => {
    render(
      <MemoryRouter initialEntries={["/reset-password?token=test-token"]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("New password"), "password-123");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "password-456",
    );
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passwords do not match.",
    );
  });
});
