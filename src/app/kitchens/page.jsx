import MarketingShell from "@/components/marketing/MarketingShell";
import { CollectionPage } from "@/components/marketing/MarketingPages";
import { collectionBySlug } from "@/data/marketing";

export const metadata = {
  title: "Custom Kitchens | Ikonic Kitchens & Cabinets",
  description: collectionBySlug.kitchens.description,
};

export default function KitchensPage() {
  return (
    <MarketingShell>
      <CollectionPage collection={collectionBySlug.kitchens} />
    </MarketingShell>
  );
}
