import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/resources");

export default function Page() {
  return <NotYetActivated href="/resources" />;
}
