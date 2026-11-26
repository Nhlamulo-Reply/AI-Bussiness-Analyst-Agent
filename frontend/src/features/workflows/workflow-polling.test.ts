import { describe, expect, it } from "vitest";
import { ApiError } from "../../lib/api-client";
import {
  getWorkflowExecutionPollDelay,
  workflowExecutionMaxPollDurationMs,
  workflowExecutionPollIntervalMs,
} from "./workflow-queries";
import type { Execution } from "./workflow.schemas";

const execution: Execution = {
  id: "execution-1",
  projectId: "project-1",
  workflowName: "requirements-analysis",
  status: "running",
  nodeStates: [],
  createdByUserId: "user-1",
  createdAt: "2026-03-04T05:06:07.000Z",
  updatedAt: "2026-03-04T05:06:07.000Z",
};

describe("workflow execution polling", () => {
  it("uses a modest default interval and stops at terminal states", () => {
    const now = Date.parse(execution.createdAt) + 10_000;
    expect(getWorkflowExecutionPollDelay(execution, undefined, now)).toBe(
      workflowExecutionPollIntervalMs,
    );
    expect(
      getWorkflowExecutionPollDelay(
        { ...execution, status: "completed" },
        undefined,
        now,
      ),
    ).toBe(false);
    expect(
      getWorkflowExecutionPollDelay(
        { ...execution, status: "failed" },
        undefined,
        now,
      ),
    ).toBe(false);
  });

  it("honors Retry-After but never schedules past the bounded deadline", () => {
    const now =
      Date.parse(execution.createdAt) +
      workflowExecutionMaxPollDurationMs -
      500;
    const rateLimitError = new ApiError(
      429,
      "RATE_LIMITED",
      "Wait before checking again.",
      undefined,
      [],
      10_000,
    );

    expect(getWorkflowExecutionPollDelay(execution, rateLimitError, now)).toBe(
      500,
    );
    expect(
      getWorkflowExecutionPollDelay(execution, rateLimitError, now - 20_000),
    ).toBe(10_000);
    expect(getWorkflowExecutionPollDelay(execution, undefined, now + 500)).toBe(
      false,
    );
  });

  it("stops polling when access is denied or the execution is unavailable", () => {
    const now = Date.parse(execution.createdAt) + 10_000;
    expect(
      getWorkflowExecutionPollDelay(
        execution,
        new ApiError(403, "FORBIDDEN", "Forbidden."),
        now,
      ),
    ).toBe(false);
    expect(
      getWorkflowExecutionPollDelay(
        execution,
        new ApiError(404, "NOT_FOUND", "Missing."),
        now,
      ),
    ).toBe(false);
  });
});
