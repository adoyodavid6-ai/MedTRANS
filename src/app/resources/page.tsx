import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";
import { formatLongDate as fmtDate } from "@/lib/content/articles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Health resources",
  description: "Health information reviewed by qualified clinicians. Each article names its reviewer and review date.",
  alternates: { canonical: "/resources" },
};

export default async function Resources() {
  const supabase = await createClient();
  const { data: articles } = await supabase.from("articles").select("slug, title, summary, reviewed_by_name, reviewed_at").eq("is_published", true).order("reviewed_at", { ascending: false });
  return (
    <>
      <PageHeader eyebrow="Resources" title="Health resources" intro="Practical information reviewed by qualified clinicians. It is general information, not a diagnosis — if you are worried, speak to a health professional." />
      <div className="container-page max-w-3xl space-y-4 py-10">
        {(articles ?? []).length === 0 ? (
          <EmptyState icon={BookOpen} title="No articles published yet">We only publish articles after a named clinician has reviewed them. Check back soon.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {(articles ?? []).map((a) => (
              <li key={a.slug}>
                <Card className="space-y-1">
                  <h2 className="text-lg font-semibold"><Link href={`/resources/${a.slug}`} className="hover:underline">{a.title}</Link></h2>
                  <p className="text-[0.95rem]">{a.summary}</p>
                  <p className="text-xs text-muted">Reviewed by {a.reviewed_by_name} · {fmtDate(a.reviewed_at as string)}</p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
