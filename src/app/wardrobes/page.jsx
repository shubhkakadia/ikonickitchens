import MarketingShell from "@/components/marketing/MarketingShell";
import { CollectionPage } from "@/components/marketing/MarketingPages";
import { collectionBySlug } from "@/data/marketing";

export const metadata = {
  title: "Custom Wardrobes | Ikonic Kitchens & Cabinets",
  description: collectionBySlug.wardrobes.description,
};

export default function WardrobesPage() {
  return (
    <MarketingShell>
      <CollectionPage collection={collectionBySlug.wardrobes} />
    </MarketingShell>
  );
}
