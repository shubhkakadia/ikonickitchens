import MarketingShell from "@/components/marketing/MarketingShell";
import { PortfolioPage } from "@/components/marketing/MarketingPages";

export const metadata = {
  title: "Our Work | Ikonic Kitchens & Cabinets",
  description:
    "Explore completed kitchens, wardrobes, bathrooms, laundries and custom joinery by Ikonic Kitchens & Cabinets.",
};

export default function Portfolio() {
  return (
    <MarketingShell>
      <PortfolioPage />
    </MarketingShell>
  );
}
