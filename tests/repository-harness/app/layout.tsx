import "../../../app/globals.css";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><main className="lab-shell"><section className="workspace">{children}</section></main></body></html>;
}
