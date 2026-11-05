import { demoCourse } from "./neural-demo";
import type { CourseDraft, ActivityDraft } from "../../types/course";
/** Deployed, versioned content. Optional media are configured at build time. */
export const neuralPilot: CourseDraft = {
  ...demoCourse, id: "neural-pilot", title: "Redes Neurais Aplicadas à Engenharia — Piloto",
  chapters: demoCourse.chapters.map(chapter => ({ ...chapter, activities: chapter.activities.map((activity): ActivityDraft => {
    if (activity.type === "video") {
      const url = activity.navigationGroup === "video-application" ? process.env.NEXT_PUBLIC_PILOT_APPLICATION_URL : process.env.NEXT_PUBLIC_PILOT_LESSON_URL;
      if (url) return { ...activity, content: { ...activity.content, url } };
      return { id: activity.id, title: activity.title, order: activity.order, required: activity.required, type: "text", content: { text: `${chapter.description}\nLeia os conceitos e as orientações deste capítulo antes de praticar no laboratório. Esta edição do piloto utiliza conteúdo textual; não há vídeo configurado.` } };
    }
    if (activity.type === "material") return { ...activity, content: { text: activity.content.text } };
    return activity;
  }).map(activity => process.env.NEXT_PUBLIC_PILOT_LESSON_URL && process.env.NEXT_PUBLIC_PILOT_APPLICATION_URL ? activity : { ...activity, navigationGroup: undefined }) })),
};
