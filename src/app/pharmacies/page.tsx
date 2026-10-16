import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/pharmacies");

export default function Page() {
  return <NotYetActivated href="/pharmacies" />;
}
