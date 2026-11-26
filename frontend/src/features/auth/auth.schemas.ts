import { z } from "zod";

export const userRoles = [
  "business_analyst",
  "product_owner",
  "delivery_lead",
  "admin",
] as const;

export const authUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.email(),
    roles: z.array(z.enum(userRoles)),
  })
  .strict();

export const credentialsSchema = z
  .object({
    email: z.string().trim().pipe(z.email()),
    password: z.string().min(12).max(128),
  })
  .strict();

export const authResponseSchema = z
  .object({
    accessToken: z.string().min(1),
    user: authUserSchema,
  })
  .strict();

export const currentUserResponseSchema = z
  .object({
    user: authUserSchema,
  })
  .strict();
export const passwordResetResponseSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export type UserRole = (typeof userRoles)[number];
export type AuthUser = z.infer<typeof authUserSchema>;
export type Credentials = z.infer<typeof credentialsSchema>;
export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};
