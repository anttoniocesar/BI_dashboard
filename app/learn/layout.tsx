import { LearnDataBoundary, LearnPersistenceNotice } from "@/components/learn/LearnDataBoundary";
import { StudentSessionHeader } from "@/components/learn/StudentHeader";
import { LearnLayoutState } from "@/components/learn/LearnLayoutState";
import "./learn.css";
import "./overview.css";
import "./sidebar.css";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return <LearnLayoutState><a className="learn-skip" href="#learn-main">Ir ao conteúdo</a><StudentSessionHeader /><main id="learn-main" className="learn-main"><LearnDataBoundary>{children}</LearnDataBoundary></main><footer className="learn-footer"><span>BI.Society Academy · Conhecimento aplicado</span><LearnPersistenceNotice /></footer></LearnLayoutState>;
}
