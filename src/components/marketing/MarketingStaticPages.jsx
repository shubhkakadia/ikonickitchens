import Image from "next/image";
import Link from "next/link";
import ImageFrame from "@/components/marketing/MarketingImageFrame";
import { FaqList } from "@/components/marketing/MarketingPages";
import {
  blogPosts,
  materials,
  processSteps,
  services,
  workshopImages,
} from "@/data/marketing";

export function ServicesPage() {
  return (
    <div className="marketing-page">
      <header className="marketing-container marketing-page-head">
        <div className="marketing-eyebrow">Services</div>
        <div className="marketing-page-head__row">
          <h1 className="marketing-display">Four things we build well</h1>
          <p>
            Custom cabinetry for the rooms that need to work hard, planned
            around your home, your storage and the way the space is used.
          </p>
        </div>
      </header>

      <section className="marketing-container marketing-rows">
        {services.map((service) => (
          <div className="marketing-service-row" key={service.name}>
            <div className="marketing-service-row__number">
              {service.number}
            </div>
            <h3>{service.name}</h3>
            <div>
              <p>{service.body}</p>
              <div className="marketing-service-row__detail">
                {service.detail}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="marketing-materials">
        <div className="marketing-container marketing-materials__layout">
          <div>
            <div className="marketing-eyebrow">Materials &amp; finishes</div>
            <p className="marketing-materials__intro">
              Material and finish choices are considered as part of each
              individual room and project brief.
            </p>
          </div>
          <div className="marketing-materials__grid">
            {materials.map((material) => (
              <div className="marketing-material" key={material.name}>
                <h3>{material.name}</h3>
                <p>{material.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="marketing-container">
        <Link href="/inquiries" className="marketing-outline-cta">
          <h2>Tell us what the room needs to do.</h2>
          <span className="marketing-text-link">Start a quote →</span>
        </Link>
      </div>
    </div>
  );
}

export function ProcessPage() {
  return (
    <div className="marketing-page">
      <header className="marketing-container marketing-page-head">
        <div className="marketing-eyebrow">Process</div>
        <div className="marketing-page-head__row">
          <h1 className="marketing-display">One room, six clear steps</h1>
          <p>
            Each project follows a considered path from the first conversation
            to final installation, with the scope clarified before manufacture
            begins.
          </p>
        </div>
      </header>

      <section className="marketing-container marketing-process-rows">
        {processSteps.map((step) => (
          <div className="marketing-process-row" key={step.number}>
            <div className="marketing-process-row__number">
              Step {step.number}
            </div>
            <div>
              <h3>{step.name}</h3>
              <div className="marketing-process-row__when">{step.when}</div>
            </div>
            <p>{step.body}</p>
          </div>
        ))}
      </section>

      <FaqList intro={false} />
    </div>
  );
}

export function WorkshopPage() {
  return (
    <div className="marketing-page marketing-container">
      <header className="marketing-page-head">
        <div className="marketing-eyebrow">The workshop</div>
        <h1 className="marketing-display">
          Elevate your space with quality cabinets
        </h1>
      </header>

      <ImageFrame
        src={workshopImages[0]}
        alt="Cabinetry being made in the workshop"
        className="marketing-workshop-page__hero"
        priority
      />

      <section className="marketing-workshop-page__content">
        <div>
          <p>
            Our mission is to provide high-quality kitchen cabinetry and
            attentive customer service, helping each client create a room that
            suits their home.
          </p>
          <p>
            Our team draws on practical industry experience and keeps up with
            current materials, finishes and manufacturing techniques.
          </p>
        </div>
        <div className="marketing-facts">
          <div className="marketing-fact-row">
            <div className="marketing-fact-row__label">What we make</div>
            <div className="marketing-fact-row__value">
              Kitchens, wardrobes, bathroom vanities and laundries
            </div>
          </div>
          <div className="marketing-fact-row">
            <div className="marketing-fact-row__label">Workshop</div>
            <div className="marketing-fact-row__value">
              5 Dundee Avenue, Holden Hill, South Australia
            </div>
          </div>
          <div className="marketing-fact-row">
            <div className="marketing-fact-row__label">Approach</div>
            <div className="marketing-fact-row__value">
              Custom design, manufacture and professional installation
            </div>
          </div>
          <div className="marketing-fact-row">
            <div className="marketing-fact-row__label">Trade work</div>
            <div className="marketing-fact-row__value">
              Residential and commercial cabinetry projects
            </div>
          </div>
          <div className="marketing-fact-row">
            <div className="marketing-fact-row__label">Visits</div>
            <div className="marketing-fact-row__value">
              Monday to Friday, 9am–5pm
            </div>
          </div>
        </div>
      </section>

      <section
        className="marketing-workshop-page__gallery"
        aria-label="Workshop and completed work"
      >
        {workshopImages.slice(1).map((image, index) => (
          <ImageFrame
            key={image}
            src={image}
            alt={
              [
                "Client consultation",
                "Completed kitchen cabinetry",
                "Completed bathroom cabinetry",
              ][index]
            }
          />
        ))}
      </section>
    </div>
  );
}

export function BlogIndexPage() {
  return (
    <div className="marketing-page marketing-container marketing-journal">
      <header className="marketing-page-head">
        <div className="marketing-eyebrow">Journal</div>
        <div className="marketing-page-head__row">
          <h1 className="marketing-display">
            Notes for planning a better room
          </h1>
          <p>
            Practical guides covering custom kitchen costs, cabinetry choices
            and what to expect from design through installation.
          </p>
        </div>
      </header>

      <div className="marketing-journal__grid">
        {blogPosts.map((post) => (
          <Link
            href={`/blogs/${post.slug}`}
            className="marketing-journal-card"
            key={post.slug}
          >
            <div className="marketing-journal-card__meta">
              {post.date} · {post.readTime}
            </div>
            <h2>{post.title}</h2>
            <p>{post.subtitle}</p>
            <span className="marketing-journal-card__read">Read article →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
