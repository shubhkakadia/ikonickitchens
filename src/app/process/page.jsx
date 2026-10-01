import MarketingShell from "@/components/marketing/MarketingShell";
import { ProcessPage } from "@/components/marketing/MarketingPages";

export const metadata = {
  title: "Our Process | Ikonic Kitchens & Cabinets",
  description:
    "How an Ikonic Kitchens & Cabinets project moves from enquiry and design through manufacture, installation and handover.",
};

export default function Process() {
  return (
    <MarketingShell>
      <ProcessPage />
    </MarketingShell>
  );
}
