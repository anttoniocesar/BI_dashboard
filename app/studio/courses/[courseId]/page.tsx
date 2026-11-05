import { CourseEditor } from "@/components/studio/courses/CourseEditor";
export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseEditor key={courseId} courseId={courseId} />;
}
