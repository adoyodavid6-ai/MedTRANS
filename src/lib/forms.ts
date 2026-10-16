import type { z } from "zod";

export type FormState = {
  ok?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** What the user submitted, echoed back so a failed submission never wipes their input. */
  values?: Record<string, string>;
};

/** First error message per field, for inline display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "_")] ??= issue.message;
  return out;
}

/** Echo of the submitted text fields (React resets forms after an action; this restores them). */
export function submittedValues(formData: FormData, names: string[]) {
  const out: Record<string, string> = {};
  for (const n of names) {
    const v = formData.get(n);
    if (typeof v === "string") out[n] = v.slice(0, 2000);
  }
  return out;
}

/** Reads string fields from FormData, turning empty strings into undefined. */
export function formFields(formData: FormData, names: string[]) {
  const out: Record<string, string | undefined> = {};
  for (const n of names) {
    const v = formData.get(n);
    out[n] = typeof v === "string" && v.trim() !== "" ? v : undefined;
  }
  return out;
}
