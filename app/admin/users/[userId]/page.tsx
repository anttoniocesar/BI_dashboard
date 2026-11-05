import { UserDetails } from "@/components/admin/UserDetails";
export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <UserDetails key={userId} userId={userId} />;
}
