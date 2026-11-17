import type { ObjectId } from "mongodb";

export interface UserRecord {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  roles: Array<"user" | "reviewer" | "admin" | "project_owner">;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  insertUser(user: Omit<UserRecord, "_id">): Promise<UserRecord>;
}
