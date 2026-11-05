import {demoCourse} from "../../data/courses/neural-demo";
import {chapterNavigationDemo} from "../../data/courses/chapter-navigation-demo";
import {neuralPilot} from "../../data/courses/neural-pilot";
import {neuralExerciseDefinition} from "../../data/exercises/neural-error-correction";
import {buildDefinition} from "../../lib/studio/exerciseDraft";
import {exerciseKey,type CourseWorkspace} from "../../lib/repositories/CourseRepository";
import {cloneWorkbook} from "../../lib/spreadsheet/workbook";
export function canonicalWorkspace(): CourseWorkspace {
 const definition={...structuredClone(neuralExerciseDefinition),workbook:cloneWorkbook(neuralExerciseDefinition.workbook)};
 return {courses:[demoCourse,chapterNavigationDemo,neuralPilot].map(course=>({...structuredClone(course),status:"published",chapters:course.chapters.map(ch=>({...structuredClone(ch),activities:ch.activities.map(a=>a.type==="spreadsheet-exercise" ? {...a,content:{...a.content,exerciseVersion:definition.version}} : structuredClone(a))}))})),exercises:[{id:definition.id,draft:definition,definition,updatedAt:new Date().toISOString()}],definitions:{[exerciseKey(definition.id,definition.version)]:buildDefinition(definition,true)}};
}
