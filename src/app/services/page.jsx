import MarketingShell from "@/components/marketing/MarketingShell";
import { ServicesPage } from "@/components/marketing/MarketingPages";

export const metadata = {
  title: "Cabinetry Services | Ikonic Kitchens & Cabinets",
  description:
    "Custom kitchens, wardrobes, bathroom vanities and laundry cabinetry designed and installed by Ikonic Kitchens & Cabinets.",
};

export default function Services() {
  return (
    <MarketingShell>
      <ServicesPage />
    </MarketingShell>
  );
}
