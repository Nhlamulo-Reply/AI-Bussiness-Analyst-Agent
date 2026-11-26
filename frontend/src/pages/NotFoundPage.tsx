import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <span className="not-found-page__icon">
        <Compass aria-hidden="true" size={23} />
      </span>
      <p className="eyebrow">A SMALL DETOUR</p>
      <h1>We couldn't find that page.</h1>
      <p>Try returning to your workspace overview.</p>
      <Link className="button button--primary button--medium" to="/app">
        <ArrowLeft aria-hidden="true" size={16} />
        <span>Back to overview</span>
      </Link>
    </main>
  );
}
