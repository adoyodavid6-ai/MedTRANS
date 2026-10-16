import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/find-a-doctor");

export default function Page() {
  return <NotYetActivated href="/find-a-doctor" />;
}
