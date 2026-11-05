import type { AdminState, User } from "../../types/admin";
import type { CourseDraft } from "../../types/course";
import { requireCourseAccess } from "../auth/access";

export function studentCourses(courses: CourseDraft[], state: AdminState, user: User | null): CourseDraft[] {
  return courses.filter(course => course.status === "published" && requireCourseAccess(state, user, course.id));
}
