import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error";

const projectIdPattern = /^[A-Za-z0-9_-]{1,128}$/;

export interface ProjectRepository {
  userCanAccessProject(projectId: string, userId: string): Promise<boolean>;
}

export function requireProjectAccess(projects: ProjectRepository): RequestHandler {
  return async (request, _response, next) => {
    const user = request.user;
    const projectParam = request.params.id ?? request.params.projectId ?? request.body?.projectId;
    const projectId = Array.isArray(projectParam) ? projectParam[0] : projectParam;
    if (!user) {
      next(new AppError(401, "UNAUTHORIZED", "Authentication is required."));
      return;
    }
    if (typeof projectId !== "string" || !projectIdPattern.test(projectId)) {
      next(new AppError(404, "NOT_FOUND", "Project not found."));
      return;
    }

    try {
      if (!(await projects.userCanAccessProject(projectId, user.id))) {
        next(new AppError(404, "NOT_FOUND", "Project not found."));
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
