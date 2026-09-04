import MarketingShell from "@/components/marketing/MarketingShell";
import { CollectionPage } from "@/components/marketing/MarketingPages";
import { collectionBySlug } from "@/data/marketing";

export const metadata = {
  title: "18 William Avenue, Henley Beach | Ikonic Kitchens & Cabinets",
  description: collectionBySlug["william-avenue-henley-beach"].description,
};

export default function WilliamAvenuePage() {
  return (
    <MarketingShell>
      <CollectionPage
        collection={collectionBySlug["william-avenue-henley-beach"]}
      />
    </MarketingShell>
  );
}
