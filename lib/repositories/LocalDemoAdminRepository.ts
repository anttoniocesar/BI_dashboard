import { AdminRepositoryBase } from "./AdminRepository";
import { createLocalAdminState } from "../admin/local-state";
import { applyAdminCommand, type AdminCommand } from "../admin/session";
import { hasPermission } from "../admin/permissions";
import { DEMO_ADMIN_STORAGE_KEY, parseDemoAdminSnapshot, serializeDemoAdminSnapshot } from "../admin/demo-storage";
import type {CourseDraft} from "../../types/course";
import {courseForNewGrant} from "../courses/versions";

type DemoStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Local development convenience only; never instantiate for Supabase mode. */
export class LocalDemoAdminRepository extends AdminRepositoryBase {
  private state = createLocalAdminState();
  private loaded = false;
  notice = "";
  constructor(private storage: () => DemoStorage,private courses?:()=>CourseDraft[]) { super(); }

  async load() {
    if (!this.loaded) {
      this.loaded = true;
      try {
        const raw = this.storage().getItem(DEMO_ADMIN_STORAGE_KEY);
        const restored = parseDemoAdminSnapshot(raw);
        if (restored) this.state = restored;
        else if (raw !== null) this.storage().removeItem(DEMO_ADMIN_STORAGE_KEY);
      } catch { this.notice = "Armazenamento administrativo indisponível. Alterações demo serão mantidas somente em memória."; }
    }
    return structuredClone(this.state);
  }

  async execute(command: AdminCommand, actorId: string, courseIds: string[]) {
    await this.load();
    if(command.type==="grant-course"&&this.courses)command={...command,courseId:courseForNewGrant(this.courses(),this.state,command.userServiceId,command.courseId).id};
    const next = applyAdminCommand(this.state, actorId, command, courseIds);
    // Validate and serialize before adopting/persisting a successful mutation.
    const snapshot = serializeDemoAdminSnapshot(next);
    this.state = next;
    try { this.storage().setItem(DEMO_ADMIN_STORAGE_KEY, snapshot); this.notice = ""; }
    catch { this.notice = "Não foi possível salvar os dados administrativos neste navegador. Alterações demo estão somente em memória."; }
    return { state: structuredClone(this.state), userId: command.type === "create-user" ? command.id : undefined };
  }

  async reset(actorId: string) {
    await this.load();
    if (!hasPermission(this.state.users.find(user => user.id === actorId), "users:manage")) throw new Error("Perfil sem permissão para restaurar a demonstração.");
    try { this.storage().removeItem(DEMO_ADMIN_STORAGE_KEY); this.notice = ""; }
    catch { this.notice = "Fixtures restauradas somente em memória. Não foi possível apagar o snapshot administrativo; os dados anteriores podem reaparecer ao reabrir."; }
    this.state = createLocalAdminState();
    return structuredClone(this.state);
  }
}
