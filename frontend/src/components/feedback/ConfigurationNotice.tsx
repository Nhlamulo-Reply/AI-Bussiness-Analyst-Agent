import { Settings2 } from "lucide-react";
import type { ZodIssue } from "zod";
import { Card } from "../ui/Card";

interface ConfigurationNoticeProps {
  issues: ZodIssue[];
}

export function ConfigurationNotice({ issues }: ConfigurationNoticeProps) {
  return (
    <main className="configuration-page">
      <Card className="configuration-card">
        <span className="configuration-card__icon">
          <Settings2 aria-hidden="true" size={22} />
        </span>
        <p className="eyebrow">One quick setup step</p>
        <h1>Connect your workspace</h1>
        <p className="configuration-card__copy">
          Set a same-origin API path or an absolute HTTP(S) backend URL before
          opening the app.
        </p>
        <div className="configuration-card__code">
          <code>VITE_API_BASE_URL=/api/v1</code>
        </div>
        <ul className="configuration-card__issues">
          {issues.map((issue) => (
            <li key={`${issue.path.join(".")}-${issue.message}`}>
              {issue.path.join(".") || "Configuration"}: {issue.message}
            </li>
          ))}
        </ul>
      </Card>
    </main>
  );
}
