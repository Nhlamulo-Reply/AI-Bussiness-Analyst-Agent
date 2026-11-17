const bearerSecurity = [{ bearerAuth: [] }];
const ok = { "200": { description: "Request completed" }, "401": { description: "Authentication required" } };
const created = { "201": { description: "Resource created" }, "400": { description: "Request validation failed" }, "401": { description: "Authentication required" } };
const jsonBody = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } }
});
const workflowPlaceholder = (summary: string) => ({
  post: {
    summary,
    security: bearerSecurity,
    requestBody: jsonBody({ $ref: "#/components/schemas/ProjectJob" }),
    responses: { "501": { description: "AI workflow is not implemented; no results generated" } }
  }
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AI Business Analyst Agent API",
    version: "0.1.0",
    description: "Phase 3 foundation and Phase 4 project/domain APIs. AI workflow endpoints remain explicit Phase 5 placeholders."
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/health/live": {
      get: { summary: "Check whether the API process is running", responses: { "200": { description: "The process is live" } } }
    },
    "/health/ready": {
      get: { summary: "Check whether JSON storage is ready", responses: { "200": { description: "API and JSON storage are ready" }, "503": { description: "Storage is unavailable" } } }
    },
    "/auth/register": {
      post: {
        summary: "Register a standard user account",
        requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }),
        responses: { "201": { description: "Account created" }, "400": { description: "Request validation failed" }, "409": { description: "Email is already registered" } }
      }
    },
    "/auth/login": {
      post: {
        summary: "Exchange credentials for an access token",
        requestBody: jsonBody({ $ref: "#/components/schemas/Credentials" }),
        responses: { "200": { description: "Authenticated" }, "401": { description: "Credentials are invalid" } }
      }
    },
    "/auth/me": {
      get: { summary: "Get the current authenticated user", security: bearerSecurity, responses: ok }
    },
    "/projects": {
      get: { summary: "List projects available to the current user", security: bearerSecurity, responses: ok },
      post: {
        summary: "Create a project",
        security: bearerSecurity,
        requestBody: jsonBody({ type: "object", required: ["name"], properties: { name: { type: "string" }, description: { type: "string" } }, additionalProperties: false }),
        responses: created
      }
    },
    "/projects/{id}": {
      get: { summary: "Get a project", security: bearerSecurity, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: ok }
    },
    "/projects/{id}/members": {
      patch: {
        summary: "Replace a project's member list (owner only)",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: jsonBody({ type: "object", required: ["memberIds"], properties: { memberIds: { type: "array", items: { type: "string" }, maxItems: 100 } }, additionalProperties: false }),
        responses: ok
      }
    },
    "/projects/{id}/documents": {
      get: { summary: "List project document metadata", security: bearerSecurity, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: ok },
      post: {
        summary: "Upload a PDF, DOCX, or UTF-8 text document (maximum 5 MB)",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } } },
        responses: created
      }
    },
    "/projects/{id}/artifacts": {
      get: { summary: "List project artifacts", security: bearerSecurity, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: ok },
      post: {
        summary: "Create a draft artifact",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: jsonBody({ type: "object", required: ["type", "title"], properties: { type: { type: "string" }, title: { type: "string" }, description: { type: "string" }, requirementIds: { type: "array", items: { type: "string" } }, data: { type: "object" } }, additionalProperties: false }),
        responses: created
      }
    },
    "/projects/{id}/export": {
      get: { summary: "Export project data as JSON, Markdown, or CSV", security: bearerSecurity, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "format", in: "query", schema: { type: "string", enum: ["json", "markdown", "csv"] } }], responses: ok }
    },
    "/projects/{projectId}/requirements": {
      get: { summary: "List project requirements", security: bearerSecurity, parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }], responses: ok },
      post: {
        summary: "Create a draft requirement",
        security: bearerSecurity,
        parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: jsonBody({ type: "object", required: ["title", "type"], properties: { title: { type: "string" }, description: { type: "string" }, type: { type: "string", enum: ["business", "functional", "non_functional"] }, priority: { type: "string" }, documentIds: { type: "array", items: { type: "string" } } }, additionalProperties: false }),
        responses: created
      }
    },
    "/requirements/{id}": {
      patch: {
        summary: "Revise a draft requirement and create a version snapshot",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: jsonBody({ type: "object", properties: { title: { type: "string" }, description: { type: "string" }, priority: { type: "string" } }, minProperties: 1, additionalProperties: false }),
        responses: ok
      }
    },
    "/requirements/{id}/versions": {
      get: { summary: "List requirement version snapshots", security: bearerSecurity, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: ok }
    },
    "/artifacts/{id}/versions": {
      get: { summary: "List artifact version snapshots", security: bearerSecurity, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "type", in: "query", required: true, schema: { type: "string", enum: ["epic", "story", "acceptance_criteria", "business_rule", "risk", "dependency", "implementation_plan"] } }], responses: ok }
    },
    "/approvals": {
      post: {
        summary: "Submit a requirement or artifact for review",
        security: bearerSecurity,
        requestBody: jsonBody({ type: "object", required: ["projectId", "artifactType", "artifactId"], properties: { projectId: { type: "string" }, artifactType: { type: "string" }, artifactId: { type: "string" }, comments: { type: "string" } }, additionalProperties: false }),
        responses: created
      }
    },
    "/approvals/{id}": {
      patch: {
        summary: "Approve, reject, or request changes (reviewer/admin; no self-review)",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: jsonBody({ type: "object", required: ["decision"], properties: { decision: { type: "string", enum: ["approved", "rejected", "changes_requested"] }, comments: { type: "string" } }, additionalProperties: false }),
        responses: { ...ok, "403": { description: "Reviewer role required or self-review attempted" }, "409": { description: "Approval already decided" } }
      }
    },
    "/users/{id}/roles": {
      patch: {
        summary: "Set user roles (admin only)",
        security: bearerSecurity,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: jsonBody({ type: "object", required: ["roles"], properties: { roles: { type: "array", items: { type: "string", enum: ["user", "reviewer", "admin", "project_owner"] } } }, additionalProperties: false }),
        responses: { ...ok, "403": { description: "Admin role required" } }
      }
    },
    "/requirements/analyze": workflowPlaceholder("Analyze project requirements (Phase 5 placeholder)"),
    "/requirements/extract": workflowPlaceholder("Extract requirements (Phase 5 placeholder)"),
    "/stories/generate": workflowPlaceholder("Generate stories (Phase 5 placeholder)"),
    "/acceptance-criteria/generate": workflowPlaceholder("Generate acceptance criteria (Phase 5 placeholder)"),
    "/requirements/validate": workflowPlaceholder("Validate requirements (Phase 5 placeholder)"),
    "/risks/analyze": workflowPlaceholder("Analyze risks (Phase 5 placeholder)"),
    "/roadmap/generate": workflowPlaceholder("Generate a roadmap (Phase 5 placeholder)"),
    "/executions/{id}": {
      get: { summary: "Get workflow execution status", security: bearerSecurity, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { ...ok, "404": { description: "Execution not found" } } }
    }
  },
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Credentials: {
        type: "object",
        required: ["email", "password"],
        properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 12, maxLength: 128 } },
        additionalProperties: false
      },
      ProjectJob: {
        type: "object",
        required: ["projectId"],
        properties: { projectId: { type: "string" }, documentIds: { type: "array", items: { type: "string" } }, requirementIds: { type: "array", items: { type: "string" } }, storyId: { type: "string" } },
        additionalProperties: false
      }
    }
  }
} as const;
