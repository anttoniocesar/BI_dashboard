import { AdminRepositoryBase, type AdminResult } from "./AdminRepository";
import type { AdminState } from "../../types/admin";
import type { AdminCommand } from "../admin/session";
import { dataRequest } from "../data/http";
export class HttpAdminRepository extends AdminRepositoryBase {
  load() { return dataRequest<AdminState>("/api/admin/session"); }
  execute(command: AdminCommand) { return dataRequest<AdminResult>("/api/admin/session", command); }
}
