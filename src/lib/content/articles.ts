export const formatLongDate = (d: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(new Date(d));

/** Splits stored article text into paragraphs (blank-line separated). Rendered as plain text — never as HTML. */
export const paragraphs = (body: string) => body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
