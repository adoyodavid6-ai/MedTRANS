import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/checkout");

export default function Page() {
  return <NotYetActivated href="/checkout" />;
}
