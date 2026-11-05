import { MonitoringPage } from "@/components/monitoring/MonitoringPage";
export default async function Page({ params }: { params:Promise<{ courseId:string; userId:string }> }) {
  const { courseId,userId } = await params;
  return <MonitoringPage courseId={courseId} userId={userId} />;
}
