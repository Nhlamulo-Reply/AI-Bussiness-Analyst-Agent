import bcrypt from "bcryptjs";
import { sign } from "jsonwebtoken";
import { AppError } from "../../common/errors/app-error";
import { DuplicateUserError, type UserRepository } from "./user.repository";

export interface AuthConfig {
  jwtSecret: string;
  jwtTtlSeconds: number;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly config: AuthConfig
  ) {}

  async register(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
    const normalizedEmail = email.trim().toLowerCase();
    if (await this.users.findByEmail(normalizedEmail)) {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
    }

    const now = new Date().toISOString();
    try {
      const user = await this.users.insertUser({
        email: normalizedEmail,
        passwordHash: await bcrypt.hash(password, 12),
        roles: ["user"],
        createdAt: now,
        updatedAt: now
      });
      return this.createSession(user);
    } catch (error) {
      if (error instanceof DuplicateUserError) {
        throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.");
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<{ accessToken: string; user: AuthUser }> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
    }
    return this.createSession(user);
  }

  private createSession(user: {
    id: string;
    email: string;
    roles: Array<"user" | "reviewer" | "admin" | "project_owner">;
  }): { accessToken: string; user: AuthUser } {
    const accessToken = sign(
      { roles: user.roles, email: user.email },
      this.config.jwtSecret,
      { subject: user.id, expiresIn: this.config.jwtTtlSeconds }
    );
    return {
      accessToken,
      user: { id: user.id, email: user.email, roles: user.roles }
    };
  }
}

export interface AuthUser {
  id: string;
  email: string;
  roles: Array<"user" | "reviewer" | "admin" | "project_owner">;
}
