import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttemptIdentity } from "../../types/exercise-attempt";
import type { ExerciseSession } from "../../types/exercise-session";
import { databaseError } from "./SupabaseAdminRepository";
export class SupabaseExerciseRepository {
  constructor(private client: SupabaseClient) {}
  async operate(operation: "load" | "save" | "clear", identity: AttemptIdentity, state?: ExerciseSession) {
    const { data, error } = await this.client.rpc("exercise_attempt_operation", { operation, identity, saved_state: state ?? null });
    if (error) databaseError(error);
    return data as { state: ExerciseSession | null; lastSavedAt: string };
  }
}
