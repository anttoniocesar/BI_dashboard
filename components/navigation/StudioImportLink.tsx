"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { labRoute, safeLabReturn } from "@/lib/navigation/labReturn";

export function StudioImportLink({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const origin = pathname !== "/studio/courses" && safeLabReturn(pathname);
  return <Link href={origin ? labRoute("/studio/import", origin) : "/studio/import"}>{children}</Link>;
}
