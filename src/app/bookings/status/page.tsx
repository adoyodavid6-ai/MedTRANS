import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/bookings/status");

export default function Page() {
  return <NotYetActivated href="/bookings/status" />;
}
