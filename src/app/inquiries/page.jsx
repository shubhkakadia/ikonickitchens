import MarketingShell from "@/components/marketing/MarketingShell";
import { QuotePage } from "@/components/marketing/MarketingPages";

export const metadata = {
  title: "Request a Quote | Ikonic Kitchens & Cabinets",
  description:
    "Contact Ikonic Kitchens & Cabinets about custom cabinetry for your kitchen, bathroom, laundry or wardrobe.",
};

export default function InquiriesPage() {
  return (
    <MarketingShell>
      <QuotePage />
    </MarketingShell>
  );
}
