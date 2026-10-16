import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/join/provider");

export default function Page() {
  return <NotYetActivated href="/join/provider" />;
}
