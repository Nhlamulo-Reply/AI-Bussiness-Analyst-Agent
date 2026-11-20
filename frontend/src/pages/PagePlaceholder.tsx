import { ArrowLeft, ArrowRight, CircleDashed, Sparkles } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";

interface PagePlaceholderProps {
  title: string;
  description: string;
}

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  const location = useLocation();
  const isProjectSetup = location.pathname.endsWith("/new");

  return (
    <div className="placeholder-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR ANALYSIS WORKSPACE</p>
          <h1>{title}</h1>
          <p className="page-heading__description">{description}</p>
        </div>
        <Badge tone="neutral">Coming in a later phase</Badge>
      </div>
      <section className="placeholder-panel">
        <EmptyState
          icon={isProjectSetup ? Sparkles : CircleDashed}
          title={
            isProjectSetup
              ? "A strong start begins with shared context."
              : "This space is ready for your work."
          }
          description="This page will connect to the real backend in its implementation phase. No sample records or simulated activity are shown."
          action={
            <Link className="button button--secondary button--medium" to="/app">
              <ArrowLeft aria-hidden="true" size={16} />
              <span>Back to overview</span>
            </Link>
          }
        />
      </section>
      <div className="placeholder-next">
        <span className="placeholder-next__icon">
          <ArrowRight aria-hidden="true" size={15} />
        </span>
        <p>
          Designed to keep your source material, analysis, and decisions
          connected.
        </p>
      </div>
    </div>
  );
}
