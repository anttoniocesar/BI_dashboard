import { CourseOverview } from "@/components/learn/CourseOverview";
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  return <CourseOverview courseId={courseId} />;
}
