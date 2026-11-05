import { LearnRepositoryBase, type LearnData } from "./LearnRepository";
import { dataRequest } from "../data/http";
import type { ProgressWrite } from "../data/validation";
export class HttpLearnRepository extends LearnRepositoryBase {
  constructor(private expectedUserId: string) { super(); }
  load() { return dataRequest<LearnData>("/api/learn/session"); }
  async saveProgress(input: ProgressWrite) { await dataRequest("/api/learn/session", input, { "X-Expected-User": this.expectedUserId }); }
}
