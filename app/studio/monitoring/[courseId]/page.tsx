import { MonitoringPage } from "@/components/monitoring/MonitoringPage";
export default async function Page({ params }: { params:Promise<{ courseId:string }> }) {
  const { courseId } = await params;
  return <MonitoringPage courseId={courseId} />;
}
