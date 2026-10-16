import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { JsonLd } from "@/components/seo/json-ld";
import { Alert } from "@/components/ui/alert";
import { formatLongDate, paragraphs } from "@/lib/content/articles";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const getArticle = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("articles")
    .select("slug, title, summary, body, reviewed_by_name, reviewed_by_credentials, reviewed_at, next_review_due, updated_at")
    .eq("slug", slug).eq("is_published", true).maybeSingle();
  return data;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = await getArticle((await params).slug);
  if (!a) return { title: "Article not found", robots: { index: false } };
  return { title: a.title, description: a.summary, alternates: { canonical: `/resources/${a.slug}` }, openGraph: { title: a.title, description: a.summary, type: "article" } };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = await getArticle((await params).slug);
  if (!a) notFound();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "MedicalWebPage", headline: a.title, description: a.summary,
    url: `${siteUrl}/resources/${a.slug}`, lastReviewed: a.reviewed_at,
    reviewedBy: { "@type": "Person", name: a.reviewed_by_name, description: a.reviewed_by_credentials },
    publisher: { "@type": "Organization", name: "MedTRANS" },
  };
  return (
    <article className="container-page max-w-2xl space-y-6 py-10">
      <JsonLd data={jsonLd} />
      <p className="text-sm"><Link href="/resources" className="underline">Health resources</Link></p>
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-navy">{a.title}</h1>
        <p className="text-lg text-muted">{a.summary}</p>
        <p className="text-sm text-muted">Clinically reviewed by <strong className="text-navy">{a.reviewed_by_name}</strong> ({a.reviewed_by_credentials}) on {formatLongDate(a.reviewed_at as string)}{a.next_review_due ? ` · next review due ${formatLongDate(a.next_review_due)}` : ""}</p>
      </header>
      <div className="space-y-4 text-[1.05rem] leading-relaxed">
        {paragraphs(a.body).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
      </div>
      <Alert tone="info" title="This is general information">
        <p>It does not replace advice from a health professional who knows your situation. If someone may be in danger, go to <Link href="/emergency" className="font-semibold underline">Emergency Help</Link>.</p>
      </Alert>
    </article>
  );
}
