import { z } from "zod";

const frontendEnvSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .min(1, "Set the backend API base URL.")
    .refine((value) => {
      if (value.startsWith("/") && !value.startsWith("//")) return true;

      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    }, "The API URL must use http or https."),
});

export function parseFrontendEnv(source: unknown) {
  return frontendEnvSchema.safeParse(source);
}
