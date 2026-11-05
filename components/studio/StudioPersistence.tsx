"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession } from "@/components/auth/AuthSession";
import { useAdminSession } from "@/components/admin/AdminSession";
import { useStudioSession } from "./StudioSession";
import { LocalCourseRepository } from "@/lib/repositories/InMemoryCourseRepository";
import { HttpCourseRepository } from "@/lib/repositories/HttpCourseRepository";

export function StudioPersistence({children}:{children:React.ReactNode}) {
  const auth = useAuthSession(), admin = useAdminSession(), studio = useStudioSession();
  const pathname = usePathname();
  const [retry,setRetry] = useState(0);
  const user = auth.currentUser;
  const key = JSON.stringify([user?.id,user?.roles,user?.status,retry]);
  const {bind} = studio;
  useEffect(() => {
    if (!auth.ready) return;
    try { void bind(user ? admin.configuration.mode === "demo" ? new LocalCourseRepository(user,admin.state,window.localStorage) : new HttpCourseRepository(user.id) : null); }
    catch (cause) { void bind({load:async()=>{throw cause;},execute:async()=>{throw cause;}}); }
    // The key captures authorization inputs, independent of projected object identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,auth.ready,bind,admin.configuration.mode]);
  if (user && !studio.ready) return <main><p role="status">Carregando cursos...</p></main>;
  // A blocked demo store must not prevent administering the in-memory fixtures.
  // Keep Studio's existing recovery screen and every Supabase path unchanged.
  const demoAdminInMemory = admin.configuration.mode === "demo" && !!admin.storageNotice && (pathname === "/admin" || pathname.startsWith("/admin/"));
  if (user && studio.error && !studio.courses.length && studio.saveStatus !== "Alterações não salvas" && !demoAdminInMemory) return <main><p role="alert">{studio.error}</p><button onClick={()=>setRetry(value=>value+1)}>Tentar carregar novamente</button></main>;
  return children;
}
