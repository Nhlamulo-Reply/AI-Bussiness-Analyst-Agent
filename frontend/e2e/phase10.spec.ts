import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const user = {
  id: "e2e-user",
  email: "analyst@example.test",
  roles: ["user"],
};

const project = {
  id: "project-e2e",
  name: "Customer onboarding",
  description: "Improve the first-use experience.",
  ownerUserId: user.id,
  members: [],
  status: "active",
  createdAt: "2026-01-02T03:04:05.000Z",
  updatedAt: "2026-01-03T03:04:05.000Z",
};

const projectPage = {
  items: [project],
  page: 1,
  limit: 12,
  total: 1,
};

async function expectNoAccessibilityViolations(page: Page) {
  await page.locator("dialog[open]").evaluateAll(async (dialogs) => {
    await Promise.all(
      dialogs.flatMap((dialog) =>
        dialog
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      ),
    );
  });
  const isAxeLoaded = await page.evaluate(() => "axe" in window);
  if (!isAxeLoaded) await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const axeWindow = window as Window & {
      axe: {
        run: (
          context: Document,
          options: { runOnly: { type: "tag"; values: string[] } },
        ) => Promise<{
          violations: Array<{
            id: string;
            impact: string | null;
            nodes: Array<{ target: string[]; failureSummary: string | null }>;
          }>;
        }>;
      };
    };
    const report = await axeWindow.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
      },
    });
    return report.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    }));
  });

  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    contentWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.contentWidth);
}

async function expectResponsiveAndAccessible(page: Page) {
  await expectNoAccessibilityViolations(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await expectNoHorizontalOverflow(page);
  await expectNoAccessibilityViolations(page);
  await page.setViewportSize({ width: 1280, height: 900 });
}

test("login is keyboard-accessible and reflows without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/login");
  await expectNoHorizontalOverflow(page);

  await expectNoAccessibilityViolations(page);

  await page.getByLabel("Business email").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("textbox", { name: "Password" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Show password" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByRole("textbox", { name: "Password" })).toHaveAttribute(
    "type",
    "text",
  );

  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Enter a valid email address.")).toBeVisible();
  await expect(
    page.getByText("Password must be at least 12 characters."),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);

  await page.goto("/register");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);
});

test("authenticated project export downloads through the protected route", async ({
  page,
}) => {
  const unexpectedRequests: string[] = [];
  const observedRequests: Array<{
    method: string;
    pathname: string;
    authorization?: string;
    cookie?: string;
  }> = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const method = request.method();
    observedRequests.push({
      method,
      pathname: requestUrl.pathname,
      authorization: request.headers().authorization,
      cookie: request.headers().cookie,
    });

    const fulfillJson = (data: unknown) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: { success: true, data, requestId: "e2e-request" },
      });

    if (method === "POST" && requestUrl.pathname === "/api/v1/auth/login") {
      return fulfillJson({ accessToken: "e2e-access-token", user });
    }
    if (method === "GET" && requestUrl.pathname === "/api/v1/auth/me") {
      return fulfillJson({ user });
    }
    if (method === "GET" && requestUrl.pathname === "/api/v1/projects") {
      return fulfillJson({
        ...projectPage,
        limit: Number(requestUrl.searchParams.get("limit")),
      });
    }
    if (
      method === "GET" &&
      requestUrl.pathname === `/api/v1/projects/${project.id}/documents`
    ) {
      return fulfillJson([]);
    }
    if (
      method === "GET" &&
      requestUrl.pathname === `/api/v1/projects/${project.id}/requirements`
    ) {
      return fulfillJson({
        items: [],
        page: Number(requestUrl.searchParams.get("page") ?? 1),
        limit: Number(requestUrl.searchParams.get("limit") ?? 12),
        total: 0,
      });
    }
    if (
      method === "GET" &&
      requestUrl.pathname === `/api/v1/projects/${project.id}/artifacts`
    ) {
      return fulfillJson({
        items: [],
        page: Number(requestUrl.searchParams.get("page") ?? 1),
        limit: Number(requestUrl.searchParams.get("limit") ?? 12),
        total: 0,
      });
    }
    if (
      method === "GET" &&
      requestUrl.pathname === `/api/v1/projects/${project.id}`
    ) {
      return fulfillJson(project);
    }
    if (
      method === "GET" &&
      requestUrl.pathname === `/api/v1/projects/${project.id}/export`
    ) {
      return route.fulfill({
        status: 200,
        contentType: "text/csv; charset=utf-8",
        headers: {
          "content-disposition":
            'attachment; filename="customer-onboarding.csv"',
        },
        body: "type,id,title,status,updatedAt\r\n",
      });
    }

    unexpectedRequests.push(`${method} ${requestUrl.pathname}`);
    return route.abort("failed");
  });

  await page.goto("/login");
  await page.getByLabel("Business email").fill(user.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("e2e-test-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expectResponsiveAndAccessible(page);

  await page.getByRole("link", { name: "Create project", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Create a project" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);
  await page.getByRole("link", { name: "All projects" }).click();

  await expect(
    page.getByRole("link", { name: "Active Customer onboarding" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);

  await page.getByRole("link", { name: "Active Customer onboarding" }).click();
  await expect(
    page.getByRole("heading", { name: "Customer onboarding" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);

  await page.setViewportSize({ width: 320, height: 740 });
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  await openNavigation.click();
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeVisible();
  await page.locator(".drawer-dialog").evaluate(async (dialog) => {
    await Promise.all(
      dialog
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });
  await expectNoAccessibilityViolations(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Navigation" })).toBeHidden();
  await expect(openNavigation).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("link", { name: "Documents", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Source documents" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);

  await page.getByRole("link", { name: "Requirements", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Requirements", exact: true }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);
  await page.getByRole("link", { name: "New requirement" }).click();
  await expect(
    page.getByRole("heading", { name: "Capture a requirement" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);
  await page.getByRole("link", { name: "Requirements register" }).click();

  await page.getByRole("link", { name: "AI workflows", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "AI workflow workbench" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);

  await page.getByRole("link", { name: "Deliverables", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Deliverables" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);
  await page.getByRole("button", { name: "New deliverable" }).click();
  await expect(
    page.getByRole("dialog", { name: "Create a deliverable" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Create a deliverable" }),
  ).toBeHidden();

  await page.getByRole("link", { name: "Exports", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/projects\/project-e2e\/exports$/);
  await expectResponsiveAndAccessible(page);

  await page.getByRole("combobox", { name: "File format" }).selectOption("csv");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download export" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("customer-onboarding.csv");
  await expect(
    page.getByRole("status").filter({ hasText: "Downloaded" }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
  expect(unexpectedRequests).toEqual([]);
  expect(
    observedRequests
      .filter((request) => request.pathname !== "/api/v1/auth/login")
      .every(
        (request) =>
          request.authorization === "Bearer e2e-access-token" &&
          request.cookie === undefined,
      ),
  ).toBe(true);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("profile screen is accessible in desktop and mobile layouts", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/login", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        success: true,
        data: { accessToken: "profile-e2e-token", user },
        requestId: "profile-e2e-request",
      },
    }),
  );
  await page.route("**/api/v1/auth/me", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: { success: true, data: { user }, requestId: "profile-e2e-request" },
    }),
  );
  await page.route("**/api/v1/projects**", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        success: true,
        data: { items: [], page: 1, limit: 100, total: 0 },
        requestId: "profile-e2e-request",
      },
    }),
  );

  await page.goto("/login");
  await page.getByLabel("Business email").fill(user.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("e2e-test-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("link", { name: /View profile/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your profile" }),
  ).toBeVisible();
  await expectResponsiveAndAccessible(page);
});

test("reviewers can inspect and decide a pending approval", async ({
  page,
}) => {
  const reviewer = { ...user, roles: ["reviewer"] };
  const approval = {
    id: "approval-e2e",
    projectId: project.id,
    artifactType: "story",
    artifactId: "artifact-e2e",
    submittedByUserId: "submitter-e2e",
    decision: "pending",
    comments: "Please review the onboarding outcome.",
    createdAt: "2026-01-03T03:04:05.000Z",
    updatedAt: "2026-01-03T03:04:05.000Z",
  };
  const resource = {
    id: approval.artifactId,
    projectId: project.id,
    type: "story",
    title: "Improve account setup",
    description: "Help new customers complete their first session.",
    status: "draft",
    requirementIds: [],
    data: { outcome: "Successful first login" },
    version: 1,
    createdByUserId: approval.submittedByUserId,
    createdAt: approval.createdAt,
    updatedAt: approval.updatedAt,
  };
  let decision = "pending";
  await page.route("**/api/v1/auth/login", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        success: true,
        data: { accessToken: "reviewer-e2e-token", user: reviewer },
        requestId: "reviewer-e2e-request",
      },
    }),
  );
  await page.route("**/api/v1/auth/me", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        success: true,
        data: { user: reviewer },
        requestId: "reviewer-e2e-request",
      },
    }),
  );
  await page.route(
    `**/api/v1/projects/${project.id}/approvals*`,
    async (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          success: true,
          data: {
            items: decision === "pending" ? [approval] : [],
            page: 1,
            limit: 12,
            total: decision === "pending" ? 1 : 0,
          },
          requestId: "reviewer-e2e-request",
        },
      }),
  );
  await page.route("**/api/v1/approvals/approval-e2e", async (route) => {
    if (route.request().method() === "PATCH") {
      decision = route.request().postDataJSON().decision;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        json: {
          success: true,
          data: { ...approval, decision },
          requestId: "reviewer-e2e-request",
        },
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      json: {
        success: true,
        data: { approval: { ...approval, decision }, resource },
        requestId: "reviewer-e2e-request",
      },
    });
  });

  await page.goto("/app/projects/project-e2e/approvals");
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Business email").fill(reviewer.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("e2e-test-password-123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/project-e2e\/approvals$/);
  await expect(page.getByRole("heading", { name: "Approvals" })).toBeVisible();
  await page.getByRole("button", { name: /User story review/ }).click();
  await expect(
    page.getByRole("heading", { name: "Improve account setup" }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(
    page
      .getByRole("region", { name: "Approval details" })
      .getByText("Approved", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No pending approvals")).toBeVisible();
  await expectResponsiveAndAccessible(page);
});

test("production preview serves nested app routes with SPA fallback", async ({
  page,
}) => {
  const response = await page.goto(
    "/app/projects/project-e2e/exports?format=csv",
  );
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});
