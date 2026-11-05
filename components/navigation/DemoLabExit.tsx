"use client";
import Link from "next/link";
import { useCurrentUser } from "@/components/auth/AuthSession";

export function DemoLabExit() {
  const user = useCurrentUser();
  const teacher = user?.roles.includes("teacher");
  const admin = user?.roles.includes("admin");
  return <Link className="lab-exit" href={teacher ? "/studio/courses" : admin ? "/admin" : user ? "/learn" : "/login"}>
    {teacher ? "← Ir para Studio" : admin ? "← Ir para Admin" : user ? "← Ir para meus cursos" : "Entrar na BI.Society"}
  </Link>;
}
