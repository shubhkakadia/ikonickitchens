import MarketingShell from "@/components/marketing/MarketingShell";
import { CollectionPage } from "@/components/marketing/MarketingPages";
import { collectionBySlug } from "@/data/marketing";

export const metadata = {
  title: "Custom Laundries | Ikonic Kitchens & Cabinets",
  description: collectionBySlug.laundry.description,
};

export default function LaundryPage() {
  return (
    <MarketingShell>
      <CollectionPage collection={collectionBySlug.laundry} />
    </MarketingShell>
  );
}
