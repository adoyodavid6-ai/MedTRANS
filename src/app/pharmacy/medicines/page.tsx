import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/pharmacy/medicines");

export default function Page() {
  return <NotYetActivated href="/pharmacy/medicines" />;
}
