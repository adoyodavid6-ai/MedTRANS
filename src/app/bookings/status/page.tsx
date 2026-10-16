import { redirect } from "next/navigation";

// Booking status lives in the signed-in account, so only the patient can see their bookings.
export default function BookingStatus() {
  redirect("/account/bookings");
}
