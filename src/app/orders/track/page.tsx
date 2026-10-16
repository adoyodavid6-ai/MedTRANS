import { redirect } from "next/navigation";

// Order tracking lives in the signed-in account, so only the patient can see their orders.
export default function TrackPage() {
  redirect("/account/orders");
}
