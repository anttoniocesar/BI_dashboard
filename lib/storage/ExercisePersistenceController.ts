import type { ExerciseDefinition } from "@/types/exercise";
import type { ExerciseSnapshot, SaveState } from "@/types/exercise-session";
import type { ExercisePersistenceContext, ExerciseRepository, SaveResult } from "@/types/exercise-repository";
import { serializeExercise } from "./exerciseSessionCodec";

export const AUTOSAVE_DELAY = 750;

/** One writer per mounted session: serialize writes and coalesce edits while a save is pending. */
export class ExercisePersistenceController {
  private latest: ExerciseSnapshot | null = null;
  private saved: ExerciseSnapshot | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: Promise<void> | null = null;
  private ready = false;
  private suspended = false;
  private disposed = false;
  private epoch = 0;
  private listeners = new Set<(state: SaveState) => void>();

  constructor(private readonly definition: ExerciseDefinition, private readonly repository: ExerciseRepository,
    private readonly context: ExercisePersistenceContext, public state: SaveState) {}

  subscribe(listener: (state: SaveState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => { this.listeners.delete(listener); };
  }

  private publish(state: SaveState) {
    this.state = state;
    if (!this.disposed) this.listeners.forEach(listener => listener(state));
  }

  update(snapshot: ExerciseSnapshot) {
    if (this.disposed || this.suspended || snapshot === this.latest) return;
    if (!this.latest) { this.latest = this.saved = snapshot; return; }
    this.latest = snapshot;
    this.ready = false;
    if (this.timer) clearTimeout(this.timer);
    this.publish({ ...this.state, status: "saving" });
    this.timer = setTimeout(() => { this.timer = null; this.ready = true; this.pump(); }, AUTOSAVE_DELAY);
  }

  private pump() {
    if (this.disposed || this.suspended || this.pending || !this.ready || !this.latest || this.saved === this.latest) return;
    const source = this.latest;
    const epoch = this.epoch;
    this.ready = false;
    let operation: Promise<SaveResult>;
    // Invoke immediately: a local adapter completes its write before a possible exit flush.
    try { operation = this.repository.save(this.context, serializeExercise(this.definition, source)); }
    catch (error) { operation = Promise.reject(error); }
    this.pending = operation
      .then(result => {
        if (epoch !== this.epoch) return;
        this.saved = source;
        if (this.latest === source) this.publish({ status: "saved", lastSavedAt: result.lastSavedAt });
      }, () => {
        if (epoch !== this.epoch) return;
        if (this.latest === source) this.publish({ ...this.state, status: "error" });
      }).finally(() => { this.pending = null; this.pump(); });
  }

  flushOnExit() {
    if (this.disposed || this.suspended || !this.latest || this.latest === this.saved || !this.repository.saveOnExit) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.ready = false;
    const source = this.latest;
    this.epoch++;
    try {
      const result = this.repository.saveOnExit(this.context, serializeExercise(this.definition, source));
      this.saved = source;
      this.publish({ status: "saved", lastSavedAt: result.lastSavedAt });
    } catch { this.publish({ ...this.state, status: "error" }); }
  }

  retry() { if (this.disposed || this.suspended) return; this.ready = true; this.publish({ ...this.state, status: "saving" }); this.pump(); }

  async clear(): Promise<void> {
    if (this.suspended || this.disposed) throw new Error("Sessão indisponível.");
    this.suspended = true;
    this.ready = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      // An older save must finish BEFORE clear; it cannot recreate the deleted session afterwards.
      await this.pending;
      await this.repository.clear(this.context);
      this.latest = this.saved = null;
      this.publish({ status: "idle", lastSavedAt: null });
    } catch (error) {
      this.publish({ ...this.state, status: "error" });
      throw error;
    } finally { this.suspended = false; }
  }

  dispose() {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.listeners.clear();
  }
}
