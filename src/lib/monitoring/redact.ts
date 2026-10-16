/**
 * Strips anything personal from a request path before it leaves the server:
 * query strings, private link tokens (support, emergency), and record ids.
 */
export function redactPath(path: string): string {
  return path
    .split("?")[0]
    .replace(/[0-9a-f]{32,}/gi, ":token")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .slice(0, 200);
}

/** Error text trimmed and with phone numbers and email addresses masked. */
export function redactMessage(message: string): string {
  return message
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[number]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .slice(0, 300);
}
