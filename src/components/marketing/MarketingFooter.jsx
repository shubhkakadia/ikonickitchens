import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="marketing-footer">
      <div className="marketing-container">
        <div className="marketing-footer__grid">
          <div>
            <Image
              src="/logo.webp"
              alt="Ikonic Kitchens and Cabinets"
              width={350}
              height={154}
              className="marketing-footer__logo"
              priority
            />
            <p className="marketing-footer__intro">
              Custom cabinetry and fitted joinery for kitchens, bathrooms,
              laundries and wardrobes across Australia.
            </p>
          </div>

          <div className="marketing-footer__column">
            <div className="marketing-footer__label">Pages</div>
            <Link href="/portfolio">Projects</Link>
            <Link href="/services">Services</Link>
            <Link href="/process">Process &amp; FAQ</Link>
            <Link href="/workshop">The workshop</Link>
            <Link href="/blogs">Journal</Link>
          </div>

          <div className="marketing-footer__column">
            <div className="marketing-footer__label">Workshop</div>
            <span>
              5 Dundee Avenue
              <br />
              Holden Hill, SA 5088
            </span>
            <span>Mon–Fri, 9am–5pm</span>
          </div>

          <div className="marketing-footer__column">
            <div className="marketing-footer__label">Contact</div>
            <a href="tel:0881653886">(08) 8165 3886</a>
            <a href="mailto:info@ikonickitchens.com.au">
              info@ikonickitchens.com.au
            </a>
            <Link href="/inquiries" className="marketing-footer__quote">
              Request a quote →
            </Link>
            <div className="marketing-footer__socials">
              <a
                href="https://www.facebook.com/p/Ikonic-Kitchens-Cabinets-61554967671495/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ikonic Kitchens and Cabinets on Facebook"
              >
                FB
              </a>
              <a
                href="https://www.instagram.com/ikonic_kitchens_cabinets/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Ikonic Kitchens and Cabinets on Instagram"
              >
                IG
              </a>
            </div>
          </div>
        </div>

        <div className="marketing-footer__bottom">
          <span>
            © {new Date().getFullYear()} Ikonic Kitchens &amp; Cabinets · All
            rights reserved
          </span>
          <div>
            <Link href="/privacy-policy">Privacy policy</Link>
            <Link href="/terms-of-service">Terms of service</Link>
            <span>Custom joinery · South Australia</span>
            <span>
              Developed by{" "}
              <a
                href="https://shubhkakadia.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Shubh Kakadia
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
