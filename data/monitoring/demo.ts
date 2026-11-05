import type { AdminState } from "../../types/admin";
import type { ProgressRow } from "../../lib/repositories/LearnRepository";
import { demoCourse as neuralDemoCourse } from "../courses/neural-demo";

/** Educational examples only, overlaid in the demo report. Never sent to Supabase
 * or added to Auth/Admin fixtures; César uses his actual session repository. */
export function demoMonitoringState(source: AdminState): AdminState {
  const createdAt = "2026-10-23T12:00:00.000Z";
  const examples = ["Ana Exemplo","Bruno Exemplo","Carla Exemplo"];
  return { ...source,
    users:[...source.users,...examples.map((name,index) => ({ id:`monitoring-demo-${index}`,name,email:`monitoring-${index}@example.com`,roles:["student" as const],status:"active" as const,createdAt }))],
    enrollments:[...source.enrollments,...examples.map((_,index) => ({ id:`monitoring-enrollment-${index}`,userId:`monitoring-demo-${index}`,registrationCode:`20279990${index}`,status:"active" as const,createdAt }))],
    userServices:[...source.userServices,...examples.map((_,index) => ({ id:`monitoring-service-${index}`,userId:`monitoring-demo-${index}`,serviceId:source.services[0]?.id ?? "standalone-course",status:"active" as const }))],
    courseAccess:[...source.courseAccess,...examples.map((_,index) => ({ userServiceId:`monitoring-service-${index}`,courseId:neuralDemoCourse.id }))],
  };
}
export function demoMonitoringRows(userId: string, now = Date.now()): ProgressRow[] | null {
  if (!userId.startsWith("monitoring-demo-")) return null;
  if (userId === "monitoring-demo-0") return [];
  const activities = neuralDemoCourse.chapters.flatMap(chapter => chapter.activities.filter(activity => activity.required).map(activity => ({ chapter,activity })));
  return (userId === "monitoring-demo-1" ? activities.slice(0,2) : activities).map(({ chapter,activity },index) => {
    const date = new Date(now - (userId === "monitoring-demo-1" ? 10 : 1)*86400000 + index*1000).toISOString();
    return { course_id:neuralDemoCourse.id,chapter_id:chapter.id,activity_id:activity.id,status:"completed",updated_at:date,completed_at:date };
  });
}
