export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  roles: Array<"user" | "reviewer" | "admin" | "project_owner">;
  createdAt: string;
  updatedAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  insertUser(user: Omit<UserRecord, "id">): Promise<UserRecord>;
}

export class DuplicateUserError extends Error {
  constructor() {
    super("A user with this email already exists");
    this.name = "DuplicateUserError";
  }
}
