import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAccount } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ArticleForm } from "../commercial-forms";

export default async function Articles() {
  await requireAccount("/ops/articles", ["admin"]);
  const supabase = await createClient();
  const { data: rows } = await supabase.from("articles").select("*").order("updated_at", { ascending: false });
  return (
    <>
      <Card className="space-y-2">
        <h2 className="text-xl font-semibold">Health articles</h2>
        <p className="text-sm text-muted">Articles are published only with a named reviewing clinician, their credentials and the review date. Changing the title or text withdraws the article until it is reviewed again.</p>
      </Card>
      {(rows ?? []).map((a) => (
        <Card key={a.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-navy">{a.title}</p>
            <div className="flex items-center gap-2">
              <Badge tone={a.is_published ? "success" : "neutral"}>{a.is_published ? "Published" : "Draft"}</Badge>
              {a.is_published ? <Link href={`/resources/${a.slug}`} className="text-sm underline">View</Link> : null}
            </div>
          </div>
          <details><summary className="cursor-pointer text-sm font-semibold text-primary">Edit</summary><div className="mt-3"><ArticleForm a={a} /></div></details>
        </Card>
      ))}
      <Card><h2 className="mb-3 text-lg font-semibold">New article</h2><ArticleForm /></Card>
    </>
  );
}
