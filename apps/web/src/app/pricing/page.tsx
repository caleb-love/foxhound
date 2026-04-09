import { redirect } from "next/navigation";

// Paid plans are not active yet. Redirect to the landing page.
export default function PricingPage() {
  redirect("/");
}
