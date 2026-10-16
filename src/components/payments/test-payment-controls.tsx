import { simulateTestPayment } from "@/lib/payments/simulate-action";

/** Test gateway only: lets a developer play the provider's part. Rendered only when the test gateway is enabled. */
export function TestPaymentControls({ paymentId }: { paymentId: string }) {
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed border-warning-ink/40 bg-warning-soft p-3">
      <p className="text-sm font-semibold text-warning-ink">Test gateway: no money moves. Choose what the provider reports.</p>
      <div className="flex flex-wrap gap-2">
        <form action={simulateTestPayment}><input type="hidden" name="payment_id" value={paymentId} /><input type="hidden" name="outcome" value="success" /><button className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white">Simulate successful payment</button></form>
        <form action={simulateTestPayment}><input type="hidden" name="payment_id" value={paymentId} /><input type="hidden" name="outcome" value="failure" /><button className="min-h-11 rounded-xl border border-line px-4 font-semibold">Simulate declined payment</button></form>
      </div>
    </div>
  );
}
