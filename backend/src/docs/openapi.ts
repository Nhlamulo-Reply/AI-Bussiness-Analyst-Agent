const bearerSecurity = [{ bearerAuth: [] }];
const ok = {
  "200": { description: "Request completed" },
  "401": { description: "Authentication required" },
};
const created = {
  "201": { description: "Resource created" },
  "400": { description: "Request validation failed" },
  "401": { description: "Authentication required" },
};
const jsonBody = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } },
});
const workflowSubmission = (summary: string) => ({
  post: {
    summary,
    security: bearerSecurity,
    requestBody: jsonBody({ $ref: "#/components/schemas/WorkflowJob" }),
    responses: {
      "202": {
        description: "Workflow queued; response includes the execution record",
      },
      "400": { description: "Request validation failed" },
      "401": { description: "Authentication required" },
      "404": { description: "Project is not accessible" },
      "429": { description: "Workflow submission limit exceeded" },
      "503": { description: "Selected LLM provider is not configured" },
    },
  },
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AI Business Analyst Agent API",
    version: "0.1.0",
    description:
      "Authenticated project and domain APIs with asynchronous LangGraph AI workflows.",
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/health/live": {
      get: {
        summary: "Check whether the API process is running",
        responses: { "200": { description: "The process is live" } },
      },
    },
    "/health/ready": {
      get: {
        summary: "Check whether JSON storage is ready",
        responses: {
          "200": { description: "API and JSON storage are ready" },
          "503": { description: "Storage is unavailable" },
        },
      },
    },
    "/auth/register": {
      post: {
        summary: "Register a standard user account",
        requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }),
        responses: {
          "201": { description: "Account created" },
          "400": { description: "Request validation failed" },
          "409": { description: "Email is already registered" },
        },
      },
    },
    "/auth/login": {
      post: {
        summary: "Exchange credentials for an access token",
        requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }),
        responses: {
          "200": { description: "Authenticated" },
          "401": { description: "Credentials are invalid" },
        },
      },
    },
    "/auth/me": {
      get: {
        summary: "Get the current authenticated user",
        security: bearerSecurity,
        responses: ok,
      },
    },
    "/projects": {
      get: {
        summary: "List projects available to the current user",
        security: bearerSecurity,
        responses: ok,
      },
      post: {
        summary: "Create a project",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string", maxLength: 160 },
            description: { type: "string", maxLength: 4000 },
            businessObjective: { type: "string", maxLength: 4000 },
            inScope: { type: "string", maxLength: 4000 },
            outOfScope: { type: "string", maxLength: 4000 },
            stakeholders: {
              type: "array",
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
            constraints: {
              type: "array",
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
            desiredOutputs: {
              type: "array",
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
            intakeTemplateId: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        }),
        responses: created,
      },
    },
    "/projects/{id}": {
      get: {
        summary: "Get a project",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: ok,
      },
      patch: {
        summary: "Update project details and brief (owner only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          minProperties: 1,
          properties: {
            name: { type: "string", maxLength: 160 },
            description: { type: "string", maxLength: 4000 },
            businessObjective: { type: "string", maxLength: 4000 },
            inScope: { type: "string", maxLength: 4000 },
            outOfScope: { type: "string", maxLength: 4000 },
            stakeholders: {
              type: "array",
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
            constraints: {
              type: "array",
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
            desiredOutputs: {
              type: "array",
              maxItems: 50,
              items: { type: "string", minLength: 1, maxLength: 200 },
            },
          },
          additionalProperties: false,
        }),
        responses: ok,
      },
    },
    "/projects/{id}/members": {
      patch: {
        summary: "Replace a project's member list (owner only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["memberIds"],
          properties: {
            memberIds: {
              type: "array",
              items: { type: "string" },
              maxItems: 100,
            },
          },
          additionalProperties: false,
        }),
        responses: ok,
      },
    },
    "/projects/{id}/documents": {
      get: {
        summary: "List project document metadata",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "includeArchived",
            in: "query",
            schema: {
              type: "boolean",
              default: false,
              description: "Owner-only; includes archived documents.",
            },
          },
        ],
        responses: ok,
      },
      post: {
        summary: "Upload a PDF, DOCX, or UTF-8 text document (maximum 5 MB)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: created,
      },
    },
    "/projects/{id}/documents/{documentId}/archive": {
      patch: {
        summary: "Soft-archive a project document (owner only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "documentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: ok,
      },
    },
    "/projects/{id}/documents/{documentId}/restore": {
      patch: {
        summary: "Restore an archived project document (owner only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "documentId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: ok,
      },
    },
    "/projects/{id}/artifacts": {
      get: {
        summary: "List project artifacts",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: ok,
      },
      post: {
        summary: "Create a draft artifact",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["type", "title"],
          properties: {
            type: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            requirementIds: { type: "array", items: { type: "string" } },
            data: { type: "object" },
          },
          additionalProperties: false,
        }),
        responses: created,
      },
    },
    "/projects/{id}/export": {
      get: {
        summary: "Export project data as JSON, Markdown, or CSV",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["json", "markdown", "csv"] },
          },
        ],
        responses: ok,
      },
    },
    "/projects/{projectId}/requirements": {
      get: {
        summary: "List project requirements",
        security: bearerSecurity,
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: ok,
      },
      post: {
        summary: "Create a draft requirement",
        security: bearerSecurity,
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["title", "type"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            type: {
              type: "string",
              enum: ["business", "functional", "non_functional"],
            },
            priority: { type: "string" },
            documentIds: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        }),
        responses: created,
      },
    },
    "/projects/{projectId}/approvals": {
      get: {
        summary: "List approvals for a project (reviewer/admin)",
        security: bearerSecurity,
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "decision",
            in: "query",
            schema: {
              type: "string",
              enum: ["pending", "approved", "rejected", "changes_requested"],
            },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: {
          ...ok,
          "200": { description: "Paginated approval records for the project" },
          "400": { description: "Invalid filter or pagination" },
          "403": { description: "Reviewer or admin role required" },
          "404": { description: "Project not found or inaccessible" },
        },
      },
    },
    "/requirements/{id}": {
      patch: {
        summary: "Revise a draft requirement and create a version snapshot",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string" },
          },
          minProperties: 1,
          additionalProperties: false,
        }),
        responses: ok,
      },
    },
    "/requirements/{id}/versions": {
      get: {
        summary: "List requirement version snapshots",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: ok,
      },
    },
    "/artifacts/{id}/versions": {
      get: {
        summary: "List artifact version snapshots",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "type",
            in: "query",
            required: true,
            schema: {
              type: "string",
              enum: [
                "epic",
                "story",
                "acceptance_criteria",
                "business_rule",
                "risk",
                "dependency",
                "implementation_plan",
              ],
            },
          },
        ],
        responses: ok,
      },
    },
    "/artifacts/{id}": {
      patch: {
        summary:
          "Revise an artifact, save its prior version, and return it to draft",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            requirementIds: { type: "array", items: { type: "string" } },
            data: { type: "object" },
          },
          minProperties: 1,
          additionalProperties: false,
        }),
        responses: {
          ...ok,
          "400": {
            description:
              "Request validation failed or a linked requirement is outside the project",
          },
          "404": { description: "Artifact not found" },
          "409": { description: "Artifact has a pending approval" },
        },
      },
    },
    "/approvals": {
      post: {
        summary: "Submit a requirement or artifact for review",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          required: ["projectId", "artifactType", "artifactId"],
          properties: {
            projectId: { type: "string" },
            artifactType: { type: "string" },
            artifactId: { type: "string" },
            comments: { type: "string" },
          },
          additionalProperties: false,
        }),
        responses: {
          ...created,
          "409": {
            description:
              "Only draft artifacts without pending approvals can be submitted",
          },
        },
      },
    },
    "/approvals/{id}": {
      get: {
        summary:
          "Get an approval and its current requirement or artifact (reviewer/admin)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          ...ok,
          "200": {
            description:
              "Approval record and its current requirement or artifact resource",
          },
          "403": { description: "Reviewer or admin role required" },
          "404": { description: "Approval not found or inaccessible" },
        },
      },
      patch: {
        summary:
          "Approve, reject, or request changes (reviewer/admin; no self-review)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["decision"],
          properties: {
            decision: {
              type: "string",
              enum: ["approved", "rejected", "changes_requested"],
            },
            comments: { type: "string" },
          },
          additionalProperties: false,
        }),
        responses: {
          ...ok,
          "403": {
            description: "Reviewer role required or self-review attempted",
          },
          "409": { description: "Approval already decided" },
        },
      },
    },
    "/users/{id}/roles": {
      patch: {
        summary: "Set user roles (admin only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["roles"],
          properties: {
            roles: {
              type: "array",
              items: {
                type: "string",
                enum: [
                  "business_analyst",
                  "product_owner",
                  "delivery_lead",
                  "admin",
                ],
              },
            },
          },
          additionalProperties: false,
        }),
        responses: { ...ok, "403": { description: "Admin role required" } },
      },
    },
    "/users/bootstrap-admin": {
      post: {
        summary:
          "Claim the first administrator using the configured bootstrap token",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          required: ["token"],
          properties: {
            token: { type: "string", minLength: 32, maxLength: 256 },
          },
          additionalProperties: false,
        }),
        responses: {
          ...ok,
          "403": { description: "Bootstrap token is invalid" },
          "404": { description: "First-admin bootstrap is disabled" },
          "409": { description: "An administrator is already configured" },
        },
      },
    },
    "/admin/users": {
      get: {
        summary: "List users without password hashes (admin only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: { ...ok, "403": { description: "Admin role required" } },
      },
    },
    "/admin/users/{id}/active": {
      patch: {
        summary: "Deactivate or reactivate a user account (admin only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["active"],
          properties: { active: { type: "boolean" } },
          additionalProperties: false,
        }),
        responses: {
          ...ok,
          "400": { description: "Self-deactivation is not allowed" },
          "403": { description: "Admin role required" },
          "404": { description: "User not found" },
          "409": { description: "The last active admin is protected" },
        },
      },
    },
    "/templates": {
      get: {
        summary: "List active templates, optionally by category",
        security: bearerSecurity,
        parameters: [
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "project_intake",
                "requirements",
                "epics_stories",
                "acceptance_criteria",
                "risks_roadmaps",
              ],
            },
          },
        ],
        responses: ok,
      },
    },
    "/admin/templates": {
      get: {
        summary: "List active and inactive templates (admin only)",
        security: bearerSecurity,
        responses: { ...ok, "403": { description: "Admin role required" } },
      },
      post: {
        summary: "Create an active template (admin only)",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          required: ["type", "name", "instructions"],
          properties: {
            type: {
              type: "string",
              enum: [
                "project_intake",
                "requirements",
                "epics_stories",
                "acceptance_criteria",
                "risks_roadmaps",
              ],
            },
            name: { type: "string", minLength: 1, maxLength: 120 },
            description: { type: "string", maxLength: 1000 },
            instructions: { type: "string", minLength: 1, maxLength: 10000 },
          },
          additionalProperties: false,
        }),
        responses: {
          ...created,
          "403": { description: "Admin role required" },
          "409": { description: "Template name and category already exist" },
        },
      },
    },
    "/admin/templates/{id}": {
      patch: {
        summary: "Edit or change the status of a template (admin only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          minProperties: 1,
          properties: {
            name: { type: "string", minLength: 1, maxLength: 120 },
            description: { type: "string", maxLength: 1000 },
            instructions: { type: "string", minLength: 1, maxLength: 10000 },
            status: { type: "string", enum: ["active", "inactive"] },
          },
          additionalProperties: false,
        }),
        responses: {
          ...ok,
          "403": { description: "Admin role required" },
          "404": { description: "Template not found" },
          "409": { description: "Template name and category already exist" },
        },
      },
    },
    "/admin/audit-events/export": {
      get: {
        summary: "Download the full audit history as JSON or CSV (admin only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["json", "csv"], default: "json" },
          },
        ],
        responses: {
          "200": { description: "Audit export downloaded" },
          "400": { description: "Unsupported export format" },
          "403": { description: "Admin role required" },
        },
      },
    },
    "/admin/audit-events": {
      get: {
        summary:
          "List append-only user, project, content, workflow, template, and approval audit events (admin only)",
        security: bearerSecurity,
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1, default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
          },
        ],
        responses: { ...ok, "403": { description: "Admin role required" } },
      },
    },
    "/requirements/analyze": workflowSubmission(
      "Analyze source documents and create draft requirements",
    ),
    "/requirements/extract": workflowSubmission(
      "Extract cited draft requirements from source documents",
    ),
    "/stories/generate": workflowSubmission(
      "Generate draft epics and template-conforming stories linked to project requirements",
    ),
    "/acceptance-criteria/generate": workflowSubmission(
      "Generate Given/When/Then criteria covering five scenario categories for a project story",
    ),
    "/requirements/validate": workflowSubmission(
      "Review project requirements and artifacts",
    ),
    "/risks/analyze": workflowSubmission("Analyze risks and dependencies"),
    "/roadmap/generate": workflowSubmission(
      "Generate an implementation roadmap",
    ),
    "/executions/{id}": {
      get: {
        summary: "Get workflow execution status and result",
        security: bearerSecurity,
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          ...ok,
          "404": {
            description: "Execution not found or project is not accessible",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Credentials: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 12, maxLength: 128 },
        },
        additionalProperties: false,
      },
      WorkflowJob: {
        type: "object",
        required: ["projectId"],
        properties: {
          projectId: { type: "string" },
          documentIds: {
            type: "array",
            items: { type: "string" },
            maxItems: 10,
          },
          shareDocumentContent: {
            type: "boolean",
            description:
              "Must be true when one or more document IDs are selected.",
          },
          requirementIds: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 100,
          },
          storyId: { type: "string", maxLength: 128 },
          templateIds: {
            type: "array",
            items: { type: "string", maxLength: 128 },
            maxItems: 10,
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
    },
  },
} as const;
