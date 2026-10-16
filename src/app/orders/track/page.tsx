import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/orders/track");

export default function Page() {
  return <NotYetActivated href="/orders/track" />;
}
