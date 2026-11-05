"use client";
import { useAdminSession } from "./AdminSession";
import { useCurrentUser } from "@/components/auth/AuthSession";
import type { AdminCommand } from "@/lib/admin/session";

/** Bind mutations to the live authenticated user, never a fixed administrator. */
export function useAdminWorkspace() {
  const session = useAdminSession();
  const user = useCurrentUser();
  return { ...session, actorId: user?.id, execute(command: AdminCommand) {
    if (!user) throw new Error("É necessário entrar para realizar esta operação.");
    return session.execute(command, user.id);
  }, resetDemo() {
    if (!user) throw new Error("É necessário entrar para realizar esta operação.");
    return session.resetDemo(user.id);
  } };
}
