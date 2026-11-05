import "server-only";
import { createSupabaseServerClient, createSupabaseServiceClient } from "../supabase/server";
import { SupabaseAdminRepository } from "../repositories/SupabaseAdminRepository";
import { SupabaseLearnRepository } from "../repositories/SupabaseLearnRepository";
import { DataError } from "../data/http";
import { dataConfiguration } from "../data/config";
import type { AuthorizedContext } from "./api";
import type { AuthSession } from "../../types/auth";
import { hasPermission } from "../admin/permissions";
import { SupabaseMonitoringRepository } from "../repositories/SupabaseMonitoringRepository";
import { SupabaseExerciseRepository } from "../repositories/SupabaseExerciseRepository";
import { SupabaseCourseRepository } from "../repositories/SupabaseCourseRepository";

export async function serverContext(): Promise<AuthorizedContext & { session: AuthSession; monitoring: SupabaseMonitoringRepository; attempts: SupabaseExerciseRepository; courses: SupabaseCourseRepository }> {
  if (dataConfiguration().mode !== "supabase") throw new DataError("É necessário entrar.",401);
  const client = await createSupabaseServerClient();
  // getUser verifies the token with Supabase Auth; no userId/session DTO from the browser is trusted.
  const result = await client.auth.getUser();
  if (result.error && (result.error.status ?? 0) >= 500) throw new DataError("Serviço de autenticação indisponível. Tente novamente.",503);
  if (result.error || !result.data.user) throw new DataError("É necessário entrar.",401);
  const reader = new SupabaseAdminRepository(client);
  let state;
  try { state = await reader.load(); } catch (cause) { if (cause instanceof DataError && cause.status === 403) throw new DataError("Sessão indisponível. Entre novamente.",401); throw cause; }
  const user = state.users.find(item => item.id === result.data.user!.id && item.status === "active");
  if (!user) throw new DataError("Sessão indisponível. Entre novamente.",401);
  // Create privileged clients lazily and only after an administrative permission check in the handler.
  const repository = new SupabaseAdminRepository(client);
  const execute = repository.execute.bind(repository);
  repository.execute = async command => {
    if (!hasPermission(user,"users:manage") && !hasPermission(user,"services:manage")) throw new DataError("Acesso não autorizado.",403);
    if (command.type === "create-user" || command.type === "update-user") {
      const privileged = new SupabaseAdminRepository(client, createSupabaseServiceClient());
      return privileged.execute(command);
    }
    return execute(command);
  };
  return { user, state, courses:new SupabaseCourseRepository(client), admin: repository, learn: new SupabaseLearnRepository(client,state,user.id), monitoring:new SupabaseMonitoringRepository(client), attempts: new SupabaseExerciseRepository(client), session: { userId: user.id, authenticatedAt: result.data.user.last_sign_in_at ?? result.data.user.created_at } };
}
