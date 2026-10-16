import { NotYetActivated, plannedMetadata } from "@/components/not-yet-activated";

export const metadata = plannedMetadata("/cart");

export default function Page() {
  return <NotYetActivated href="/cart" />;
}
