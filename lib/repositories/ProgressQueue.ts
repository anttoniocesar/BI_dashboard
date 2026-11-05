import type { LearnRepository } from "./LearnRepository";
import type { ProgressWrite } from "../data/validation";
/** Per-user serial queue. A cookie belonging to a later login must never receive
 * the previous person's pending writes. Retry resumes only with the same user. */
export class ProgressQueue {
  private pending: ProgressWrite[] = [];
  private running: Promise<void> | null = null;
  constructor(private repository: LearnRepository, private canWrite: () => boolean, private report: (status: string) => void) {}
  enqueue(input: ProgressWrite) { this.pending.push(input); void this.flush(); }
  flush(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.drain().finally(() => { this.running=null; });
    return this.running;
  }
  private async drain() {
    if (!this.pending.length || !this.canWrite()) return;
    this.report("Salvando progresso...");
    while (this.pending.length && this.canWrite()) {
      try { await this.repository.saveProgress(this.pending[0]); this.pending.shift(); }
      catch { this.report("Não foi possível salvar o progresso. Tente novamente antes de atualizar a página."); return; }
    }
    if (!this.pending.length) this.report("Progresso salvo.");
  }
}
