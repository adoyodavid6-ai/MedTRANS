import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export function FormStatus({ state }: { state: FormState }) {
  if (state.error) return <Alert tone="warning" role="alert" title={state.error} />;
  if (state.ok) return <Alert tone="success" role="status" title={state.ok} />;
  return null;
}
