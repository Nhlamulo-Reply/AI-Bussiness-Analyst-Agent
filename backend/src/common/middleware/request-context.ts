import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export function createRequestId(request: Request, response: Response): string {
  const suppliedId = request.header("x-request-id");
  const requestId = suppliedId && requestIdPattern.test(suppliedId) ? suppliedId : randomUUID();
  response.setHeader("X-Request-Id", requestId);
  return requestId;
}
