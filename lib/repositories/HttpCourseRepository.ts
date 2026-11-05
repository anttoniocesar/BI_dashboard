import { dataRequest } from "../data/http";
import type { CourseOperation, CourseRepository, CourseWorkspace } from "./CourseRepository";
export class HttpCourseRepository implements CourseRepository {
  constructor(private userId: string) {}
  load() { return dataRequest<CourseWorkspace>("/api/courses",undefined,{"X-Expected-User":this.userId}); }
  execute(operation: CourseOperation) { return dataRequest<CourseWorkspace>("/api/courses",operation,{"X-Expected-User":this.userId}); }
}
