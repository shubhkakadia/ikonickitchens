import MarketingShell from "@/components/marketing/MarketingShell";
import { HomePage } from "@/components/marketing/MarketingPages";

export const metadata = {
  title: "Custom Kitchens & Cabinets Adelaide | Ikonic",
  description:
    "Custom kitchens, wardrobes, bathroom vanities and laundries designed, manufactured and installed by Ikonic Kitchens & Cabinets.",
};

export default function Home() {
  return (
    <MarketingShell>
      <HomePage />
    </MarketingShell>
  );
}
