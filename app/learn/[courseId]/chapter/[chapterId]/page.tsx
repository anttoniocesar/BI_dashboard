import { ChapterPlayer } from "@/components/learn/ChapterPlayer";
export default async function Page({ params }: { params: Promise<{ courseId: string; chapterId: string }> }) {
  const { courseId, chapterId } = await params;
  return <ChapterPlayer key={`${courseId}/${chapterId}`} courseId={courseId} chapterId={chapterId} />;
}
