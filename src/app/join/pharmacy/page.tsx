import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/join/pharmacy");

export default function Page() {
  return <NotYetActivated href="/join/pharmacy" />;
}
