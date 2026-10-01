import MarketingShell from "@/components/marketing/MarketingShell";
import { BlogIndexPage } from "@/components/marketing/MarketingPages";

export const metadata = {
  title: "Journal | Ikonic Kitchens & Cabinets",
  description: "Practical guides for planning custom kitchens and cabinetry.",
};

export default function BlogsPage() {
  return (
    <MarketingShell>
      <BlogIndexPage />
    </MarketingShell>
  );
}
