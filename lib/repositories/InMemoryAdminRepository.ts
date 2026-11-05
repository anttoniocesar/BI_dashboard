import { AdminRepositoryBase } from "./AdminRepository";
import { createAdminFixtures } from "../../data/admin/demo";
import { applyAdminCommand, type AdminCommand } from "../admin/session";
import type { AdminState } from "../../types/admin";
export class InMemoryAdminRepository extends AdminRepositoryBase {
  constructor(private state: AdminState = createAdminFixtures()) { super(); this.state = structuredClone(state); }
  async load() { return structuredClone(this.state); }
  async execute(command: AdminCommand, actorId: string, courseIds: string[]) {
    this.state = applyAdminCommand(this.state, actorId, command, courseIds);
    return { state: await this.load(), userId: command.type === "create-user" ? command.id : undefined };
  }
}
