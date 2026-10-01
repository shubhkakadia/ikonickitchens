import MarketingShell from "@/components/marketing/MarketingShell";
import { WorkshopPage } from "@/components/marketing/MarketingPages";

export const metadata = {
  title: "The Workshop | Ikonic Kitchens & Cabinets",
  description:
    "Learn about the approach behind Ikonic Kitchens & Cabinets and visit the Holden Hill workshop.",
};

export default function Workshop() {
  return (
    <MarketingShell>
      <WorkshopPage />
    </MarketingShell>
  );
}
