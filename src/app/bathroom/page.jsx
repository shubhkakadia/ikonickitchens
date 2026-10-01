import MarketingShell from "@/components/marketing/MarketingShell";
import { CollectionPage } from "@/components/marketing/MarketingPages";
import { collectionBySlug } from "@/data/marketing";

export const metadata = {
  title: "Bathroom Cabinetry | Ikonic Kitchens & Cabinets",
  description: collectionBySlug.bathrooms.description,
};

export default function BathroomPage() {
  return (
    <MarketingShell>
      <CollectionPage collection={collectionBySlug.bathrooms} />
    </MarketingShell>
  );
}
