import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/smartcare/map");

export default function Page() {
  return <NotYetActivated href="/smartcare/map" />;
}
