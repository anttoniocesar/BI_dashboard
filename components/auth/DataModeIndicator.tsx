"use client";
import { useAdminSession } from "@/components/admin/AdminSession";
export function DataModeIndicator() { const { configuration } = useAdminSession(); return process.env.NODE_ENV === "development" ? <small className="data-mode-indicator">{configuration.mode === "demo" ? "Modo demonstração" : "Dados Supabase"}</small> : null; }
