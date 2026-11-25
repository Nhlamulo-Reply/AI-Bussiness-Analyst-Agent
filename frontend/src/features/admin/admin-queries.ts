import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { listAvailableTemplates } from "./admin-api";
import type { TemplateType } from "./admin.schemas";

export const templateKeys = {
  available: (userId: string, type?: TemplateType) =>
    ["templates", userId, type ?? "all"] as const,
};

export function useAvailableTemplates(type?: TemplateType) {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: templateKeys.available(userId ?? "anonymous", type),
    queryFn: ({ signal }) => {
      if (!userId) throw new Error("Sign in to load templates.");
      return listAvailableTemplates(type, signal);
    },
    enabled: Boolean(userId && type),
  });
}
