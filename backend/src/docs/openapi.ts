export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "AI Business Analyst Agent API",
    version: "0.1.0",
    description: "Phase 3 backend foundation. Analysis and domain APIs are added in later phases."
  },
  servers: [{ url: "/api/v1" }],
  paths: {
    "/health/live": {
      get: {
        summary: "Check whether the API process is running",
        responses: {
          "200": { description: "The process is live" }
        }
      }
    },
    "/health/ready": {
      get: {
        summary: "Check whether the API can reach MongoDB",
        responses: {
          "200": { description: "The API and database are ready" },
          "503": { description: "The database is unavailable" }
        }
      }
    },
    "/auth/register": {
      post: {
        summary: "Register a standard user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 12, maxLength: 128 }
                },
                additionalProperties: false
              }
            }
          }
        },
        responses: {
          "201": { description: "Account created" },
          "400": { description: "Request validation failed" },
          "409": { description: "Email is already registered" },
          "429": { description: "Authentication rate limit exceeded" }
        }
      }
    },
    "/auth/login": {
      post: {
        summary: "Exchange credentials for a short-lived access token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Credentials" }
            }
          }
        },
        responses: {
          "200": { description: "Authenticated" },
          "400": { description: "Request validation failed" },
          "401": { description: "Credentials are invalid" },
          "429": { description: "Authentication rate limit exceeded" }
        }
      }
    },
    "/auth/me": {
      get: {
        summary: "Get the current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Current user" },
          "401": { description: "Authentication is required" }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
    },
    schemas: {
      Credentials: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 12, maxLength: 128 }
        },
        additionalProperties: false
      },
      ErrorResponse: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { const: false },
          error: {
            type: "object",
            required: ["code", "message", "details", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "array", items: { type: "object" } },
              requestId: { type: "string" }
            }
          }
        }
      }
    }
  }
} as const;
