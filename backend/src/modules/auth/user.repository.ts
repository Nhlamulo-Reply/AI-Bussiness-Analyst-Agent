export const userRoles = ["user", "reviewer", "admin", "project_owner"] as const;
export type UserRole = typeof userRoles[number];

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  insertUser(user: Omit<UserRecord, "id">): Promise<UserRecord>;
  updateUserRoles(userId: string, roles: UserRecord["roles"]): Promise<UserRecord | null>;
}

export class DuplicateUserError extends Error {
  constructor() {
    super("A user with this email already exists");
    this.name = "DuplicateUserError";
  }
}
