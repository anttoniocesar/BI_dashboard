import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminState } from "../../types/admin";
import type { AdminCommand } from "../admin/session";
import { AdminRepositoryBase } from "./AdminRepository";
import { DataError } from "../data/http";
import { emptyAdminState } from "../data/config";

export function databaseError(error: { code?: string } | null): never {
  if (error?.code === "42501") throw new DataError("Acesso não autorizado.", 403);
  if (error?.code === "23505") throw new DataError("Este cadastro ou vínculo já existe.", 409);
  if (error?.code === "22023" || error?.code === "23503" || error?.code === "23514") throw new DataError("Verifique os dados e os vínculos ativos.");
  throw new DataError("Não foi possível concluir a operação de dados. Tente novamente.", 503);
}
/** Session-bound RPCs are authorized again in PostgreSQL. A privileged client is
 * injected only by the server after session/permission validation. */
export class SupabaseAdminRepository extends AdminRepositoryBase {
  constructor(private client: SupabaseClient, private privileged?: SupabaseClient) { super(); }
  async load(): Promise<AdminState> {
    const { data, error } = await this.client.rpc("app_snapshot");
    if (error) databaseError(error);
    return data as AdminState;
  }
  async execute(command: AdminCommand) {
    let userId: string | undefined;
    let previousEmail: string | undefined;
    let appliedCommand = command;
    if (command.type === "create-user") {
      if (!this.privileged) throw new DataError("Criação de usuário indisponível.", 503);
      const result = await this.privileged.auth.admin.createUser({ email: command.email.trim().toLowerCase(), email_confirm: true, user_metadata: { name: command.name.trim() } });
      if (result.error || !result.data.user) throw new DataError("Não foi possível criar o usuário. Verifique o email.");
      userId = result.data.user.id;
      appliedCommand = { ...command, id: userId };
    } else if (command.type === "update-user") {
      const previous = await this.getUser(command.userId);
      if (!previous) throw new DataError("Usuário não encontrado.", 404);
      if (previous.email !== command.email.trim().toLowerCase()) {
        if (!this.privileged) throw new DataError("Atualização de email indisponível.", 503);
        previousEmail = previous.email;
        const { error } = await this.privileged.auth.admin.updateUserById(command.userId, { email: command.email.trim().toLowerCase(), email_confirm: true });
        if (error) throw new DataError("Não foi possível atualizar o email.");
      }
    }
    const { error } = await this.client.rpc("admin_command", { command: appliedCommand });
    if (error) {
      if (userId) await this.privileged!.auth.admin.deleteUser(userId);
      if (previousEmail && command.type === "update-user") await this.privileged!.auth.admin.updateUserById(command.userId, { email: previousEmail, email_confirm: true });
      databaseError(error);
    }
    // Self-inactivation is successful even though the new snapshot is forbidden.
    try { return { state: await this.load(), userId }; }
    catch (cause) { if (cause instanceof DataError && cause.status === 403) return { state: emptyAdminState(), userId }; throw cause; }
  }
}
