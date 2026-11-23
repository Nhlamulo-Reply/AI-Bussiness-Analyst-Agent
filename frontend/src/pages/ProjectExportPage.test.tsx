import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../features/auth/auth.schemas";
import { clearSession, setSession } from "../lib/auth-store";
import { ProjectExportRoute } from "./ProjectExportPage";

const user: AuthUser = {
  id: "user-1",
  email: "analyst@example.com",
  roles: ["user"],
};

const createObjectURLDescriptor = Object.getOwnPropertyDescriptor(
  URL,
  "createObjectURL",
);
const revokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(
  URL,
  "revokeObjectURL",
);

function restoreUrlMethod(
  name: "createObjectURL" | "revokeObjectURL",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(URL, name, descriptor);
  } else {
    Reflect.deleteProperty(URL, name);
  }
}

describe("ProjectExportPage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "/api/v1");
    setSession({ accessToken: "test-token", user });
    fetchMock = vi.fn().mockResolvedValue(
      new Response("type,id,title,status,updatedAt", {
        headers: {
          "Content-Disposition": 'attachment; filename="project-project-1.csv"',
          "Content-Type": "text/csv; charset=utf-8",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:project-export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restoreUrlMethod("createObjectURL", createObjectURLDescriptor);
    restoreUrlMethod("revokeObjectURL", revokeObjectURLDescriptor);
  });

  it("requests and downloads the selected project export format", async () => {
    const userActions = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/app/projects/project-1/exports"]}>
        <Routes>
          <Route
            path="/app/projects/:projectId/exports"
            element={<ProjectExportRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await userActions.selectOptions(
      screen.getByRole("combobox", { name: "File format" }),
      "csv",
    );
    await userActions.click(
      screen.getByRole("button", { name: "Download export" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Downloaded project-project-1.csv.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/v1/projects/project-1/export?format=csv",
    );
    expect(
      new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("Bearer test-token");
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
  });

  it("shows a clear error when the export endpoint rejects the request", async () => {
    const userActions = userEvent.setup();
    fetchMock.mockResolvedValue(
      Response.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Project access denied.",
            details: [],
          },
        },
        { status: 403 },
      ),
    );
    render(
      <MemoryRouter initialEntries={["/app/projects/project-1/exports"]}>
        <Routes>
          <Route
            path="/app/projects/:projectId/exports"
            element={<ProjectExportRoute />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await userActions.click(
      screen.getByRole("button", { name: "Download export" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Export unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("You don't have access to this project."),
    ).toBeInTheDocument();
  });
});
