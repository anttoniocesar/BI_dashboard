import type { AdminState, User } from "../../types/admin";
import { applyCourseOperation, visibleWorkspace } from "../courses/authoring";
import { emptyWorkspace, type CourseRepository, type CourseOperation, type CourseWorkspace } from "./CourseRepository";

export class InMemoryCourseRepository implements CourseRepository {
  constructor(protected workspace: CourseWorkspace, protected user: User, protected state: AdminState, private usedCourseIds: string[] = []) {}
  async load() { return visibleWorkspace(this.workspace,this.user,this.state); }
  async execute(operation: CourseOperation) { const next = applyCourseOperation(this.workspace,operation,this.user,this.state,this.usedCourseIds); await this.persist(next); this.workspace = next; return this.load(); }
  protected async persist(_workspace: CourseWorkspace): Promise<void> {}
}
export const COURSE_STORAGE_KEY = "bi-society:course-authoring:v1";
export class LocalCourseRepository extends InMemoryCourseRepository {
  constructor(user: User, state: AdminState, private storage: Pick<Storage,"getItem" | "setItem">) {
    const raw = storage.getItem(COURSE_STORAGE_KEY);
    const workspace = raw ? JSON.parse(raw) as CourseWorkspace : emptyWorkspace();
    if (!Array.isArray(workspace.courses) || !Array.isArray(workspace.exercises) || !workspace.definitions) throw new Error("Biblioteca local inválida. Preserve os dados antes de recuperar o armazenamento.");
    super(workspace,user,state);
  }
  async execute(operation: CourseOperation) {
    if (typeof window !== "undefined" && navigator.locks) {
      return navigator.locks.request(COURSE_STORAGE_KEY, () => this.executeLatest(operation));
    }
    return this.executeLatest(operation);
  }
  private executeLatest(operation: CourseOperation) {
    // Re-read before every mutation: another tab may have saved a new activity link.
    // Web Locks serialize browser tabs; read/check/write has no await inside it.
    const raw = this.storage.getItem(COURSE_STORAGE_KEY);
    const current: CourseWorkspace = raw ? JSON.parse(raw) : emptyWorkspace();
    const next = applyCourseOperation(current,operation,this.user,this.state);
    this.storage.setItem(COURSE_STORAGE_KEY,JSON.stringify(next));
    this.workspace = next;
    return this.load();
  }
  protected async persist(workspace: CourseWorkspace) { this.storage.setItem(COURSE_STORAGE_KEY,JSON.stringify(workspace)); }
}
