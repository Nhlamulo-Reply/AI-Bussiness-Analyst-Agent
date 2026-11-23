export const userRoles = [
  "business_analyst",
  "product_owner",
  "delivery_lead",
  "admin",
] as const;
export type UserRole = typeof userRoles[number];

export interface UserRecord {
  id: string;
  email: string;
  passwordHash?: string;
  googleSubject?: string;
  sessionVersion?: number;
  roles: UserRole[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(userId: string): Promise<UserRecord | null>;
  insertUser(
    user: Omit<UserRecord, "id" | "active" | "sessionVersion"> & {
      active?: boolean;
      sessionVersion?: number;
    },
  ): Promise<UserRecord>;
  updateUserRoles(userId: string, roles: UserRecord["roles"]): Promise<UserRecord | null>;
}

export class DuplicateUserError extends Error {
  constructor() {
    super("A user with this email already exists");
    this.name = "DuplicateUserError";
  }
}
