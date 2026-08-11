"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export default function PageBreadcrumb({
  crumbs,
  actions,
}: {
  crumbs: Crumb[];
  actions?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="page-breadcrumb">
      <div className="page-breadcrumb-left">
        <button
          type="button"
          className="page-breadcrumb-back"
          onClick={() => router.back()}
          aria-label="Go back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <nav className="page-breadcrumb-trail">
          {crumbs.map((c, i) => (
            <span key={i} className="page-breadcrumb-item">
              {c.href ? (
                <Link href={c.href} className="page-breadcrumb-link">
                  {c.label}
                </Link>
              ) : (
                <span className="page-breadcrumb-current">{c.label}</span>
              )}
              {i < crumbs.length - 1 && <span className="page-breadcrumb-sep">/</span>}
            </span>
          ))}
        </nav>
      </div>
      {actions && <div className="page-breadcrumb-actions">{actions}</div>}
    </div>
  );
}
