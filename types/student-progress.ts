export type StudentCourseProgress = {
  courseId: string;
  completedActivities: string[];
  currentChapterId: string | null;
};

export type CourseAccessPolicy = { sequentialChapters: boolean };
export type ChapterProgress = {
  id: string;
  requiredCount: number;
  completedCount: number;
  percent: number;
  completed: boolean;
  available: boolean;
  status: "Concluído" | "Atual" | "Disponível" | "Bloqueado";
};
