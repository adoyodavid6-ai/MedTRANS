import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/doctorcare/book");

export default function Page() {
  return <NotYetActivated href="/doctorcare/book" />;
}
