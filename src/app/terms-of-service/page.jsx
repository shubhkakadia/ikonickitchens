import Link from "next/link";
import MarketingShell from "@/components/marketing/MarketingShell";
import LegalPage from "@/components/marketing/LegalPage";

export const metadata = {
  title: "Terms of Service | Ikonic Kitchens and Cabinets",
  description:
    "Terms governing use of the Ikonic Kitchens and Cabinets website.",
};

const sections = [
  {
    title: "Acceptance of these terms",
    content: (
      <p>
        By accessing or using this website, you agree to these Terms of Service.
        If you do not agree, please do not use the website. These terms apply to
        website browsing, portfolio viewing, enquiries and newsletter
        subscriptions.
      </p>
    ),
  },
  {
    title: "Website information and enquiries",
    content: (
      <p>
        We aim to keep this website, including portfolio images, service
        descriptions and other information, accurate and up to date. However,
        website content is general information only and may change without
        notice. An enquiry or request for a quote does not create a contract,
        guarantee availability or confirm a price, scope, timeline or outcome.
      </p>
    ),
  },
  {
    title: "Project agreements",
    content: (
      <p>
        Quotes, scopes of work, payment arrangements, manufacture, installation,
        warranties, variations and project timelines are governed by the
        separately agreed written quote, contract or other project documentation
        between you and Ikonic Kitchens and Cabinets. If there is any
        inconsistency, that written project documentation prevails over these
        website terms.
      </p>
    ),
  },
  {
    title: "Acceptable use",
    content: (
      <>
        <p>You must not use this website in a way that:</p>
        <ul>
          <li>is unlawful, fraudulent, harmful or misleading;</li>
          <li>
            interferes with the website, its security or another person&apos;s
            use of it;
          </li>
          <li>
            attempts to gain unauthorised access to systems, accounts or data;
            or
          </li>
          <li>
            uses automated means to copy, scrape or collect website content
            without our permission.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Intellectual property",
    content: (
      <p>
        Unless otherwise stated, this website and its content—including text,
        photographs, project images, designs, logos and branding—are owned by or
        licensed to Ikonic Kitchens and Cabinets. You may view the content for
        personal, non-commercial use only. You must not reproduce, distribute,
        modify or use it commercially without our prior written permission.
      </p>
    ),
  },
  {
    title: "Third-party services and links",
    content: (
      <p>
        This website may link to or embed third-party services, including Google
        Maps and social-media platforms. We do not control and are not
        responsible for their content, availability or privacy practices. Your
        use of a third-party service is subject to that provider&apos;s terms
        and privacy policy.
      </p>
    ),
  },
  {
    title: "Liability",
    content: (
      <p>
        To the maximum extent permitted by law, we do not guarantee that this
        website will be uninterrupted, error-free, secure or free of harmful
        components. We are not liable for loss arising from your reliance on
        general website content or your use of, or inability to use, this
        website. Nothing in these terms excludes, restricts or modifies rights
        that cannot lawfully be excluded under Australian Consumer Law.
      </p>
    ),
  },
  {
    title: "Indemnity",
    content: (
      <p>
        To the extent permitted by law, you indemnify Ikonic Kitchens and
        Cabinets against losses, claims and costs arising from your unlawful use
        of this website or breach of these terms.
      </p>
    ),
  },
  {
    title: "Changes and governing law",
    content: (
      <p>
        We may update these terms from time to time by publishing the revised
        version on this page. These terms are governed by the laws of South
        Australia and the applicable laws of Australia. Courts in South
        Australia have non-exclusive jurisdiction over disputes relating to
        these terms.
      </p>
    ),
  },
];

export default function TermsOfServicePage() {
  return (
    <MarketingShell>
      <LegalPage
        title="Terms of service"
        updated="Effective 6 August 2026"
        intro="These terms govern use of the Ikonic Kitchens and Cabinets website. Project-specific quotes, scopes, payment arrangements and timelines are governed by the separately agreed project documents."
        sections={sections}
      >
        <>
          <section className="marketing-legal__section">
            <h2>Contact us</h2>
            <address className="marketing-legal__contact">
              Ikonic Kitchens and Cabinets
              <br />
              5 Dundee Avenue, Holden Hill, South Australia 5088, Australia
              <br />
              <a href="mailto:info@ikonickitchens.com.au">
                info@ikonickitchens.com.au
              </a>
            </address>
          </section>
          <p className="marketing-legal__afterword">
            Please also read our{" "}
            <Link href="/privacy-policy">Privacy Policy</Link> to understand how
            we handle personal information.
          </p>
        </>
      </LegalPage>
    </MarketingShell>
  );
}
