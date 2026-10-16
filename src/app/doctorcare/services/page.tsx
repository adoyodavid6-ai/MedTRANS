import { redirect } from "next/navigation";

// Services are listed on the DoctorCare page.
export default function ServicesIndex() {
  redirect("/doctorcare#services-heading");
}
