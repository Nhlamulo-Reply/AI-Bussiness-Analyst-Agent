declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: {
        id: string;
        email: string;
        roles: Array<"user" | "reviewer" | "admin" | "project_owner">;
      };
    }
  }
}

export {};
