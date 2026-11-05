import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseWorkspace, ReplaceActivityExercise } from "./CourseRepository";
import { DataError } from "../data/http";
import { databaseError } from "./SupabaseAdminRepository";
import { buildDefinition } from "../studio/exerciseDraft";
/** Writes use the server-only service client, after API domain/actor validation. */
export class SupabaseCourseRepository {
  constructor(private client: SupabaseClient) {}
  async load(): Promise<CourseWorkspace> {
    const {data,error} = await this.client.rpc("course_workspace");
    if (error) databaseError(error);
    const workspace=data as CourseWorkspace;
    for(const entry of workspace.exercises)entry.definition=buildDefinition(entry.draft);
    for(const course of workspace.courses)for(const ch of course.chapters)for(const a of ch.activities)if(a.navigationGroup===null)delete a.navigationGroup;
    return workspace;
  }
  async write(actor: string, payload: unknown, privileged: SupabaseClient) {
    const {error} = await privileged.rpc("save_course_authoring",{actor,payload});
    if (error) databaseError(error);
  }
  async replaceExercise(actor: string, payload: ReplaceActivityExercise, privileged: SupabaseClient) {
    const {error} = await privileged.rpc("replace_activity_exercise",{actor,payload});
    if (error?.code === "40001") throw new DataError("O curso foi alterado em outra aba ou sessão. Recarregue o curso antes de substituir.",409);
    if (error?.code === "23514") throw new DataError("A substituição não é permitida. Preserve atividades publicadas e confira o exercício selecionado.",409);
    if (error) databaseError(error);
  }
  async createRevision(actor:string,payload:{sourceCourseId:string;expectedUpdatedAt:string},newCourseId:string,privileged:SupabaseClient){
    const {error}=await privileged.rpc("create_course_revision",{actor,payload:{...payload,newCourseId}});
    if(error?.code==="23505")throw new DataError("Já existe uma versão em rascunho deste curso. Abra o rascunho existente.",409);
    if(error?.code==="40001")throw new DataError("O curso foi alterado. Recarregue antes de criar nova versão.",409);
    if(error?.code==="23514")throw new DataError("A versão publicada é imutável. Crie uma nova versão a partir da publicação.",409);
    if(error)databaseError(error);
  }
}
