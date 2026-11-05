"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdminSession } from "@/components/admin/AdminSession";
import { DemoAuthAdapter } from "@/lib/auth/DemoAuthAdapter";
import { SupabaseAuthAdapter } from "@/lib/auth/SupabaseAuthAdapter";
import { requireAuthenticatedUser } from "@/lib/auth/access";
import { emptyAdminState } from "@/lib/data/config";
import type { AuthSession } from "@/types/auth";
import type { AuthAdapter } from "@/lib/auth/AuthAdapter";
function useAuthState() {
  const { state, replaceState, configuration } = useAdminSession();
  const currentState = useRef(state); currentState.current = state;
  const [adapter] = useState<AuthAdapter>(() => process.env.NEXT_PUBLIC_DATA_MODE === "supabase" ? new SupabaseAuthAdapter() : configuration.mode === "demo" ? new DemoAuthAdapter(() => currentState.current, () => sessionStorage) : new SupabaseAuthAdapter());
  const router = useRouter(); const pathname = usePathname();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [restored, setRestored] = useState(false);
  const [validatedPath, setValidatedPath] = useState("");
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const [loggedOut, setLoggedOut] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [error, setError] = useState(configuration.error ?? "");
  const ready = restored && (configuration.mode === "demo" || validatedPath === pathname);
  const currentUser = requireAuthenticatedUser(state,session);
  const restorePath = configuration.mode === "demo" ? "" : pathname;
  useEffect(() => {
    const token = ++generation.current;
    if (configuration.error) { setError(configuration.error); setRestored(true); setValidatedPath(restorePath); return; }
    if (loggedOut) { setRestored(true); setValidatedPath(restorePath); return; }
    adapter.restore().then(result => {
      if (token !== generation.current) return;
      if (configuration.mode === "supabase") replaceState(result.state ?? emptyAdminState());
      setSession(result.session); setError("");
    }).catch(() => {
      if (token !== generation.current) return;
      if (configuration.mode === "demo") setStorageNotice("Armazenamento da aba indisponível. O login será mantido somente em memória.");
      else setError("Não foi possível carregar sua sessão. Tente novamente.");
    }).finally(() => { if (token === generation.current) { setRestored(true); setValidatedPath(restorePath); } });
    return () => { generation.current++; };
  }, [adapter,configuration,replaceState,restorePath,version,loggedOut]);
  useEffect(() => { if (ready && session && !currentUser) { setSession(null); void adapter.logout().catch(() => {}); router.replace("/login"); } }, [ready,session,currentUser,adapter,router]);
  async function login(identifier: string, password: string) {
    const result = await adapter.login(identifier,password); generation.current++;
    if (result.state) replaceState(result.state);
    if (result.notice) setStorageNotice(result.notice);
    setSession(result.session); setLoggedOut(false); setError(""); setRestored(true); setValidatedPath(pathname);
    return requireAuthenticatedUser(result.state ?? currentState.current,result.session)!;
  }
  async function logout() {
    try { await adapter.logout(); generation.current++; setLoggedOut(true); setSession(null); if (configuration.mode === "supabase") replaceState(emptyAdminState()); setError(""); router.replace("/login"); }
    catch { setError("Não foi possível sair. Tente novamente."); }
  }
  return { session, ready, loggedOut, currentUser, storageNotice, login, logout, error, retry: () => setVersion(value => value+1) };
}
const Context = createContext<ReturnType<typeof useAuthState> | null>(null);
export function AuthSessionProvider({ children }: { children: React.ReactNode }) { return <Context.Provider value={useAuthState()}>{children}</Context.Provider>;
}
export function useAuthSession() { const session = useContext(Context); if (!session) throw new Error("Contexto de autenticação ausente."); return session; }
export function useCurrentUser() { return useAuthSession().currentUser; }
