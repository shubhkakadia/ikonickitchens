import Footer from "@/components/marketing/MarketingFooter";
import Navbar from "@/components/marketing/MarketingNavbar";

export default function MarketingShell({ children, pageClass = "" }) {
  return (
    <div className={`marketing-site ${pageClass}`.trim()}>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
