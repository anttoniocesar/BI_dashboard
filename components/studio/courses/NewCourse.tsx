"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStudioSession } from "@/components/studio/StudioSession";
import { createCourse } from "@/lib/studio/courseDraft";
import { CourseDetailsForm } from "./CourseDetailsForm";

export function NewCourse() {
  const { saveCourse } = useStudioSession(); const router = useRouter();
  return <><div className="course-page-heading"><div><span className="course-kicker">CURSO AVULSO · RASCUNHO</span><h1>Novo curso</h1><p>Defina os dados iniciais e depois adicione os capítulos.</p></div><Link href="/studio/courses" className="studio-secondary">Voltar aos cursos</Link></div>
    <section className="studio-panel"><CourseDetailsForm onSave={async details => { const course = createCourse(details); await saveCourse(course); router.push(`/studio/courses/${course.id}`); }} /></section></>;
}
