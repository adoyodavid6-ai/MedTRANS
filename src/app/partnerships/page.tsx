import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/partnerships");

export default function Page() {
  return <NotYetActivated href="/partnerships" />;
}
