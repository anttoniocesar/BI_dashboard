import { demoCourse } from "../../data/courses/neural-demo";
import { chapterNavigationDemo } from "../../data/courses/chapter-navigation-demo";
import type { CourseDraft } from "../../types/course";
import { neuralPilot } from "../../data/courses/neural-pilot";
import { demoCatalogEnabled } from "../data/demo-catalog";

/** Repository data by default; sample courses require an explicit demo opt-in. */
export function courseCatalog(courses: CourseDraft[], demo = demoCatalogEnabled()): CourseDraft[] {
  if (!demo || process.env.NEXT_PUBLIC_DATA_MODE === "supabase") return courses;
  const demonstrations = process.env.NEXT_PUBLIC_PILOT_ONLY === "1" ? [neuralPilot] : [demoCourse, chapterNavigationDemo];
  return [...demonstrations.map(course => ({...course,status:"published" as const})), ...courses.filter(course => !demonstrations.some(demo => demo.id === course.id))];
}
