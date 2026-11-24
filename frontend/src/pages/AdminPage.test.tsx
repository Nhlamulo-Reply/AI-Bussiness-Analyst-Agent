import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimFirstAdmin,
  createAdminTemplate,
  inviteAdminUser,
  listAdminProjectAccess,
  listAdminTemplates,
  listAdminAuditEvents,
  listAdminUsers,
  updateAdminUserActive,
  updateAdminProjectMembers,
  updateAdminUserRoles,
} from "../features/admin/admin-api";
import type { AdminUser } from "../features/admin/admin.schemas";
import { useAuth } from "../features/auth/useAuth";
import { AdminPage } from "./AdminPage";

vi.mock("../features/admin/admin-api", () => ({
  claimFirstAdmin: vi.fn(),
  createAdminTemplate: vi.fn(),
  inviteAdminUser: vi.fn(),
  listAdminAuditEvents: vi.fn(),
  listAdminProjectAccess: vi.fn(),
  listAdminTemplates: vi.fn(),
  listAdminUsers: vi.fn(),
  updateAdminUserActive: vi.fn(),
  updateAdminProjectMembers: vi.fn(),
  updateAdminUserRoles: vi.fn(),
}));

vi.mock("../features/auth/useAuth", () => ({
  useAuth: vi.fn(),
}));

const adminUser: AdminUser = {
  id: "admin-1",
  email: "admin@example.test",
  roles: ["admin"],
  active: true,
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

const memberUser: AdminUser = {
  id: "member-1",
  email: "member@example.test",
  roles: ["business_analyst"],
  active: true,
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

function renderAdminPage(isAdmin: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    session: {
      accessToken: "test-token",
      user: {
        id: "admin-1",
        email: "admin@example.test",
        roles: isAdmin ? ["business_analyst", "admin"] : ["business_analyst"],
      },
    },
  } as ReturnType<typeof useAuth>);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AdminPage />
    </QueryClientProvider>,
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listAdminProjectAccess).mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    });
  });

  it("offers a one-time bootstrap claim to authenticated non-admin users", async () => {
    vi.mocked(claimFirstAdmin).mockResolvedValue({
      id: "admin-1",
      email: "admin@example.test",
      roles: ["admin"],
      requiresLogin: true,
    });
    renderAdminPage(false);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Bootstrap token"),
      "one-time-bootstrap-token-with-at-least-32-chars",
    );
    await user.click(
      screen.getByRole("button", { name: "Claim administrator access" }),
    );

    expect(vi.mocked(claimFirstAdmin).mock.calls[0]?.[0]).toBe(
      "one-time-bootstrap-token-with-at-least-32-chars",
    );
    expect(
      await screen.findByText(/sign out and sign in again/i),
    ).toBeInTheDocument();
    expect(listAdminUsers).not.toHaveBeenCalled();
  });

  it("shows user and audit data and allows changing another user's roles", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({
      items: [adminUser, memberUser],
      page: 1,
      limit: 100,
      total: 2,
    });
    vi.mocked(listAdminAuditEvents).mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    });
    vi.mocked(listAdminTemplates).mockResolvedValue([]);
    vi.mocked(updateAdminUserRoles).mockResolvedValue({
      id: "member-1",
      email: "member@example.test",
      roles: ["business_analyst", "product_owner"],
    });
    renderAdminPage(true);
    const user = userEvent.setup();

    expect(await screen.findByText("member@example.test")).toBeInTheDocument();
    expect(screen.getByText("Audit history")).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("checkbox", {
        name: "Product Owner / Stakeholder",
      })[0],
    );
    await user.click(screen.getAllByRole("button", { name: "Save roles" })[0]);

    await waitFor(() =>
      expect(updateAdminUserRoles).toHaveBeenCalledWith("member-1", [
        "business_analyst",
        "product_owner",
      ]),
    );
  });

  it("deactivates another user without offering self-deactivation", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({
      items: [adminUser, memberUser],
      page: 1,
      limit: 100,
      total: 2,
    });
    vi.mocked(listAdminAuditEvents).mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    });
    vi.mocked(listAdminTemplates).mockResolvedValue([]);
    vi.mocked(updateAdminUserActive).mockResolvedValue({
      id: "member-1",
      email: "member@example.test",
      roles: ["business_analyst"],
      active: false,
    });
    renderAdminPage(true);
    const user = userEvent.setup();

    await screen.findByText("member@example.test");
    expect(
      screen.getByText("You cannot deactivate your own account."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deactivate" }));

    await waitFor(() =>
      expect(updateAdminUserActive).toHaveBeenCalledWith("member-1", false),
    );
  });

  it("creates an administrator-managed template", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({
      items: [adminUser],
      page: 1,
      limit: 100,
      total: 1,
    });
    vi.mocked(listAdminAuditEvents).mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    });
    vi.mocked(listAdminTemplates).mockResolvedValue([]);
    vi.mocked(createAdminTemplate).mockResolvedValue({
      id: "template-1",
      type: "requirements",
      name: "Evidence first",
      description: "Separate facts from assumptions.",
      instructions: "Cite source evidence.",
      status: "active",
      createdByUserId: "admin-1",
      createdAt: "2026-03-04T05:06:07.000Z",
      updatedAt: "2026-03-04T05:06:07.000Z",
    });
    renderAdminPage(true);
    const user = userEvent.setup();

    await screen.findByRole("heading", { name: "Create template" });
    await user.selectOptions(screen.getByLabelText("Category"), "requirements");
    await user.type(screen.getByLabelText("Name"), "Evidence first");
    await user.type(
      screen.getByLabelText("Description"),
      "Separate facts from assumptions.",
    );
    await user.type(
      screen.getByLabelText("Instructions"),
      "Cite source evidence.",
    );
    await user.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() =>
      expect(createAdminTemplate).toHaveBeenCalledWith({
        type: "requirements",
        name: "Evidence first",
        description: "Separate facts from assumptions.",
        instructions: "Cite source evidence.",
      }),
    );
  });

  it("creates a copyable invitation for a project role", async () => {
    vi.mocked(listAdminUsers).mockResolvedValue({
      items: [adminUser],
      page: 1,
      limit: 100,
      total: 1,
    });
    vi.mocked(listAdminAuditEvents).mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    });
    vi.mocked(listAdminTemplates).mockResolvedValue([]);
    vi.mocked(inviteAdminUser).mockResolvedValue({
      user: {
        id: "invitee-1",
        email: "new@example.test",
        roles: ["business_analyst", "product_owner"],
        active: false,
      },
      invitationUrl:
        "https://app.example.test/reset-password?token=one-time-token",
      expiresAt: "2026-03-04T05:06:07.000Z",
      invitationResent: false,
    });
    renderAdminPage(true);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Email address"), "new@example.test");
    await user.click(
      screen.getByRole("checkbox", { name: "Product Owner / Stakeholder" }),
    );
    await user.click(screen.getByRole("button", { name: "Create invitation" }));

    await waitFor(() =>
      expect(vi.mocked(inviteAdminUser).mock.calls[0]?.[0]).toEqual({
        email: "new@example.test",
        roles: ["business_analyst", "product_owner"],
      }),
    );
    expect(await screen.findByLabelText("Invitation link")).toHaveValue(
      "https://app.example.test/reset-password?token=one-time-token",
    );
    expect(
      screen.getByText(/invitation created\. share this one-time link/i),
    ).toBeInTheDocument();
  });

  it("allows administrators to edit project membership without project content access", async () => {
    const projectAccess = {
      id: "project-1",
      name: "Project one",
      status: "active" as const,
      ownerUserId: "member-1",
      memberIds: [],
    };
    vi.mocked(listAdminUsers).mockResolvedValue({
      items: [adminUser, memberUser],
      page: 1,
      limit: 100,
      total: 2,
    });
    vi.mocked(listAdminAuditEvents).mockResolvedValue({
      items: [],
      page: 1,
      limit: 100,
      total: 0,
    });
    vi.mocked(listAdminTemplates).mockResolvedValue([]);
    vi.mocked(listAdminProjectAccess).mockResolvedValue({
      items: [projectAccess],
      page: 1,
      limit: 100,
      total: 1,
    });
    vi.mocked(updateAdminProjectMembers).mockResolvedValue({
      ...projectAccess,
      memberIds: ["member-1"],
    });
    renderAdminPage(true);
    const user = userEvent.setup();

    await user.selectOptions(
      await screen.findByRole("listbox", { name: "Members for Project one" }),
      "member-1",
    );
    await user.click(screen.getByRole("button", { name: "Save membership" }));

    await waitFor(() =>
      expect(updateAdminProjectMembers).toHaveBeenCalledWith("project-1", [
        "member-1",
      ]),
    );
    expect(
      screen.getByText(/administrators do not receive project content access/i),
    ).toBeInTheDocument();
  });
});
