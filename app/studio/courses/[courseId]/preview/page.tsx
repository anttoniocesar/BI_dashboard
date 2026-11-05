import { CourseStudentPreview } from "@/components/studio/courses/CourseStudentPreview";
import "@/app/learn/learn.css";
export default async function Page({params}:{params:Promise<{courseId:string}>}) { const {courseId} = await params; return <CourseStudentPreview courseId={courseId} />; }
