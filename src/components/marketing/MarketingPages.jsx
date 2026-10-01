"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import emailjs from "@emailjs/browser";
import MarketingImageModal from "@/components/marketing/MarketingImageModal";
import {
  blogPosts,
  collections,
  contactDetails,
  faqs,
  heroSlides,
  materials,
  processSteps,
  services,
  testimonials,
  workshopImages,
} from "@/data/marketing";

function ImageFrame({
  src,
  alt,
  className = "",
  priority = false,
  zoom = false,
}) {
  return (
    <div className={`marketing-image-frame ${className}`.trim()}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 1240px) 100vw, 1160px"
        className={zoom ? "marketing-image-zoom" : undefined}
      />
    </div>
  );
}

export function FaqList({ intro = true }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="marketing-container marketing-faq-section">
      <div className="marketing-faq-layout">
        <div>
          <h2>Common questions</h2>
          {intro && (
            <p className="marketing-faq-layout__intro">
              If your question is not covered here, call or email the workshop.
            </p>
          )}
        </div>
        <div>
          {faqs.map((item, index) => {
            const open = openIndex === index;
            return (
              <div className="marketing-faq__item" key={item.question}>
                <button
                  type="button"
                  className="marketing-faq__button"
                  aria-expanded={open}
                  aria-controls={`faq-answer-${index}`}
                  onClick={() => setOpenIndex(open ? -1 : index)}
                >
                  <span className="marketing-faq__question">
                    {item.question}
                  </span>
                  <span className="marketing-faq__sign" aria-hidden="true">
                    {open ? "−" : "+"}
                  </span>
                </button>
                {open && (
                  <p
                    className="marketing-faq__answer"
                    id={`faq-answer-${index}`}
                  >
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function HomePage() {
  const [heroIndex, setHeroIndex] = useState(0);
  const [timerVersion, setTimerVersion] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroIndex((current) => (current + 1) % heroSlides.length);
    }, 5200);
    return () => window.clearInterval(interval);
  }, [timerVersion]);

  const pickHero = (index) => {
    setHeroIndex((index + heroSlides.length) % heroSlides.length);
    setTimerVersion((version) => version + 1);
  };

  const featured = collections.slice(0, 3);

  return (
    <div className="marketing-page">
      <section className="marketing-hero" aria-label="Featured work">
        <div className="marketing-hero__viewport">
          <div
            className="marketing-hero__track"
            style={{ transform: `translateX(-${heroIndex * 25}%)` }}
          >
            {heroSlides.map((slide, index) => (
              <div className="marketing-hero__slide" key={slide.image}>
                <Image
                  src={slide.image}
                  alt={slide.label}
                  fill
                  priority={index === 0}
                  sizes="100vw"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="marketing-hero__overlay" />

        <div className="marketing-hero__content">
          <div className="marketing-hero__grid">
            <div>
              <div className="marketing-hero__kicker">
                Cabinetmakers · Adelaide, South Australia
              </div>
              <h1>
                Kitchens and cabinetry,
                <br />
                crafted with precision.
              </h1>
              <p className="marketing-hero__lede">
                Custom kitchens, wardrobes, bathroom vanities and laundries,
                designed, manufactured and professionally installed for your
                home.
              </p>
              <div className="marketing-hero__actions">
                <Link
                  href="/portfolio"
                  className="marketing-btn marketing-btn--light"
                >
                  See the work
                </Link>
                <Link
                  href="/inquiries"
                  className="marketing-btn marketing-btn--ghost-light"
                >
                  Request a quote
                </Link>
              </div>
            </div>
          </div>

          <div className="marketing-hero__footer">
            <div>
              <div className="marketing-hero__caption-kicker">
                {heroSlides[heroIndex].place}
              </div>
              <div className="marketing-hero__caption-title">
                {heroSlides[heroIndex].label}
              </div>
            </div>

            <div className="marketing-hero__controls">
              <div
                className="marketing-hero__dots"
                aria-label="Choose hero image"
              >
                {heroSlides.map((slide, index) => (
                  <button
                    type="button"
                    key={slide.image}
                    className="marketing-hero__dot"
                    aria-label={`Show ${slide.label}`}
                    aria-current={index === heroIndex}
                    onClick={() => pickHero(index)}
                  />
                ))}
              </div>
              <div className="marketing-hero__arrows">
                <button
                  type="button"
                  className="marketing-hero__arrow"
                  aria-label="Previous hero image"
                  onClick={() => pickHero(heroIndex - 1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="marketing-hero__arrow"
                  aria-label="Next hero image"
                  onClick={() => pickHero(heroIndex + 1)}
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-container marketing-services-summary">
        <div className="marketing-split-heading">
          <div className="marketing-eyebrow">What we make</div>
          <div className="marketing-service-summary__grid">
            {services.map((service) => (
              <Link
                href="/services"
                className="marketing-service-summary__item"
                key={service.name}
              >
                <div className="marketing-service-summary__title">
                  <span className="marketing-service-summary__number">
                    {service.number}
                  </span>
                  <span className="marketing-service-summary__name">
                    {service.name}
                  </span>
                </div>
                <p className="marketing-service-summary__blurb">
                  {service.blurb}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-dark-section">
        <div className="marketing-container">
          <div className="marketing-section-heading">
            <h2 className="marketing-section-title">Recent rooms</h2>
            <Link href="/portfolio" className="marketing-text-link">
              All projects →
            </Link>
          </div>
          <div className="marketing-featured-grid">
            {featured.map((project) => (
              <Link href={project.href} key={project.slug}>
                <ImageFrame
                  src={project.cover}
                  alt={project.title}
                  className="marketing-card__image"
                  zoom
                />
                <div className="marketing-card__meta">
                  <span className="marketing-card__title">{project.title}</span>
                  <span className="marketing-card__type">{project.type}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="marketing-container marketing-workshop-feature">
        <ImageFrame
          src="/expertise.webp"
          alt="Hands guiding timber through workshop equipment"
          className="marketing-workshop-feature__image"
        />
        <div>
          <div className="marketing-eyebrow">The workshop</div>
          <h2>
            Designed, made and installed
            <br />
            with one clear purpose.
          </h2>
          <p>
            Our work combines practical planning, carefully considered materials
            and experienced installation to create cabinetry that fits the room
            and the way it is used.
          </p>
          <div className="marketing-proof-grid">
            <div>
              <strong>Custom made</strong>
              <span>Designed specifically for your room</span>
            </div>
            <div>
              <strong>Complete service</strong>
              <span>From consultation through installation</span>
            </div>
            <div>
              <strong>Free quotes</strong>
              <span>Start with a conversation about your project</span>
            </div>
          </div>
        </div>
      </section>

      <section className="marketing-testimonials">
        <div className="marketing-container marketing-testimonials__grid">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name}>
              <div className="marketing-testimonial__quote">
                “{testimonial.quote}”
              </div>
              <div className="marketing-testimonial__name">
                {testimonial.name}
              </div>
              <div className="marketing-testimonial__role">
                {testimonial.role}
              </div>
            </div>
          ))}
        </div>
      </section>

      <FaqList />

      <div className="marketing-container marketing-cta-wrap">
        <Link href="/inquiries" className="marketing-cta">
          <div>
            <h2>Planning cabinetry for your home?</h2>
            <p>
              Tell us about the room, the storage you need and any ideas you
              already have. We will help you work out the next step.
            </p>
          </div>
          <span className="marketing-cta__link">Request a quote →</span>
        </Link>
      </div>
    </div>
  );
}

export function PortfolioPage() {
  const filters = [
    "All",
    "Projects",
    "Kitchens",
    "Wardrobes",
    "Bathrooms",
    "Laundry",
  ];
  const [filter, setFilter] = useState("All");
  const visible =
    filter === "All"
      ? collections
      : collections.filter((collection) => collection.category === filter);

  return (
    <div className="marketing-page marketing-container marketing-work-page">
      <header className="marketing-page-head">
        <div className="marketing-eyebrow">Projects</div>
        <h1 className="marketing-display">Rooms we have finished</h1>
      </header>

      <div className="marketing-filters" aria-label="Filter projects">
        {filters.map((item) => (
          <button
            type="button"
            key={item}
            className="marketing-filter"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="marketing-work-grid" aria-live="polite">
        {visible.map((project, index) => (
          <Link href={project.href} key={project.slug}>
            <ImageFrame
              src={project.cover}
              alt={project.title}
              className="marketing-work-card__image"
              priority={index < 4}
              zoom
            />
            <div className="marketing-work-card__meta">
              <span className="marketing-work-card__title">
                {project.title}
              </span>
              <span className="marketing-work-card__location">
                {project.location}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CollectionPage({ collection }) {
  const [selectedImage, setSelectedImage] = useState(null);

  const [hero, portrait, firstLandscape, ...remaining] = collection.images;

  return (
    <div className="marketing-page marketing-container marketing-detail">
      <Link href="/portfolio" className="marketing-detail__back">
        ← All projects
      </Link>

      <div className="marketing-detail__heading">
        <h1>{collection.title}</h1>
        <p>{collection.description}</p>
      </div>

      {collection.metadata?.length > 0 && (
        <div className="marketing-detail__facts">
          {collection.metadata.map((fact) => (
            <div key={fact.label}>
              <div className="marketing-detail__fact-label">{fact.label}</div>
              <div className="marketing-detail__fact-value">{fact.value}</div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setSelectedImage(hero)}
        aria-label={`Open ${collection.title} hero image`}
        style={{
          display: "block",
          width: "100%",
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "zoom-in",
        }}
      >
        <ImageFrame
          src={hero}
          alt={`${collection.title} overview`}
          className="marketing-detail__hero"
          priority
        />
      </button>

      {portrait && (
        <div className="marketing-detail__pair">
          <button
            type="button"
            onClick={() => setSelectedImage(portrait)}
            aria-label={`Open ${collection.title} detail image`}
            style={{
              display: "block",
              padding: 0,
              border: 0,
              background: "transparent",
              cursor: "zoom-in",
            }}
          >
            <ImageFrame
              src={portrait}
              alt={`${collection.title} detail`}
              className="marketing-detail__portrait"
            />
          </button>
          <div className="marketing-detail__copy">
            <div className="marketing-eyebrow">About the collection</div>
            <p>{collection.description}</p>
          </div>
        </div>
      )}

      {firstLandscape && (
        <div className="marketing-detail__pair">
          <button
            type="button"
            onClick={() => setSelectedImage(firstLandscape)}
            aria-label={`Open another ${collection.title} image`}
            style={{
              display: "block",
              padding: 0,
              border: 0,
              background: "transparent",
              cursor: "zoom-in",
            }}
          >
            <ImageFrame
              src={firstLandscape}
              alt={`${collection.title} joinery`}
              className="marketing-detail__landscape"
            />
          </button>
          {remaining[0] ? (
            <button
              type="button"
              onClick={() => setSelectedImage(remaining[0])}
              aria-label={`Open another ${collection.title} image`}
              style={{
                display: "block",
                padding: 0,
                border: 0,
                background: "transparent",
                cursor: "zoom-in",
              }}
            >
              <ImageFrame
                src={remaining[0]}
                alt={`${collection.title} room view`}
                className="marketing-detail__landscape"
              />
            </button>
          ) : (
            <div />
          )}
        </div>
      )}

      {remaining.length > 1 && (
        <>
          <h2 className="marketing-detail__gallery-title">
            More from the collection
          </h2>
          <div className="marketing-detail__gallery">
            {remaining.slice(1).map((image, index) => (
              <button
                type="button"
                key={image}
                onClick={() => setSelectedImage(image)}
                aria-label={`Open ${collection.title} gallery image ${index + 5}`}
              >
                <ImageFrame
                  src={image}
                  alt={`${collection.title} gallery image ${index + 5}`}
                  zoom
                />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="marketing-detail__nav">
        <Link href="/portfolio" className="marketing-text-link">
          ← Back to projects
        </Link>
        <Link href="/inquiries" className="marketing-text-link">
          Discuss your project →
        </Link>
      </div>

      {selectedImage && (
        <MarketingImageModal
          src={selectedImage}
          alt={`${collection.title} enlarged image`}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

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

const jobTypes = ["Kitchen", "Wardrobes", "Bathroom", "Laundry", "Other"];
const budgets = ["Under $20k", "$20k–40k", "$40k–70k", "$70k+", "Not sure yet"];

export function QuotePage() {
  const [jobType, setJobType] = useState("Kitchen");
  const [budget, setBudget] = useState("Not sure yet");
  const [submitStatus, setSubmitStatus] = useState("idle");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const templateId =
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID_INQUIRIES ||
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    setSubmitStatus("sending");

    try {
      if (!serviceId || !templateId || !publicKey) {
        throw new Error("EmailJS inquiry configuration is incomplete");
      }

      await emailjs.send(
        serviceId,
        templateId,
        {
          to_name: "Ikonic Kitchens and Cabinets",
          from_name: fields.get("name"),
          name: fields.get("name"),
          from_email: fields.get("email"),
          email: fields.get("email"),
          reply_to: fields.get("email"),
          phone_number: fields.get("phone"),
          phone: fields.get("phone"),
          suburb: fields.get("suburb") || "Not supplied",
          job_type: jobType,
          project_type: jobType,
          rough_budget: budget,
          budget,
          message: fields.get("message"),
        },
        publicKey,
      );

      form.reset();
      setJobType("Kitchen");
      setBudget("Not sure yet");
      setSubmitStatus("success");
    } catch (error) {
      console.error("Unable to send inquiry:", error);
      setSubmitStatus("error");
    }
  };

  const contactRows = [
    {
      label: "Phone",
      value: contactDetails.phone,
      sub: contactDetails.mobiles.join(" · "),
      href: contactDetails.phoneHref,
    },
    {
      label: "Email",
      value: contactDetails.email,
      sub: "Contact the workshop directly",
      href: `mailto:${contactDetails.email}`,
    },
    {
      label: "Workshop",
      value: contactDetails.address,
      sub: "Open in Google Maps",
      href: contactDetails.mapsHref,
      external: true,
    },
    {
      label: "Hours",
      value: contactDetails.hours,
      sub: "Closed weekends and public holidays",
    },
    {
      label: "Projects",
      value: "Kitchens, bathrooms, laundries and wardrobes",
      sub: "Residential and commercial cabinetry",
    },
  ];

  return (
    <div className="marketing-page marketing-container marketing-contact">
      <div className="marketing-eyebrow">Request a quote</div>
      <h1 className="marketing-display">Send us the room</h1>

      <div className="marketing-contact__layout">
        <div>
          {submitStatus === "success" && (
            <div className="marketing-form__notice" role="status">
              <strong>Thank you. Your enquiry has been sent.</strong>
              The workshop has received your project details and can reply using
              the contact information you provided.
            </div>
          )}

          {submitStatus !== "success" && (
            <>
              {submitStatus === "error" && (
                <div
                  className="marketing-form__notice marketing-form__notice--error"
                  role="alert"
                >
                  <strong>We could not send your enquiry.</strong>
                  Please try again, email{" "}
                  <a href={`mailto:${contactDetails.email}`}>
                    {contactDetails.email}
                  </a>
                  , or call{" "}
                  <a href={contactDetails.phoneHref}>{contactDetails.phone}</a>.
                </div>
              )}
              <form className="marketing-form" onSubmit={handleSubmit}>
                <div className="marketing-form__row">
                  <label className="marketing-form__field">
                    <span className="marketing-form__label">Name</span>
                    <input
                      name="name"
                      placeholder="First and last"
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label className="marketing-form__field">
                    <span className="marketing-form__label">Phone</span>
                    <input
                      name="phone"
                      type="tel"
                      placeholder="04__ ___ ___"
                      autoComplete="tel"
                      required
                    />
                  </label>
                </div>

                <div className="marketing-form__row">
                  <label className="marketing-form__field">
                    <span className="marketing-form__label">Email</span>
                    <input
                      name="email"
                      type="email"
                      placeholder="you@email.com.au"
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="marketing-form__field">
                    <span className="marketing-form__label">Suburb</span>
                    <input
                      name="suburb"
                      placeholder="Where is the job?"
                      autoComplete="address-level2"
                    />
                  </label>
                </div>

                <div className="marketing-form__choice">
                  <span className="marketing-form__label">
                    What do you need made?
                  </span>
                  <div className="marketing-form__chips">
                    {jobTypes.map((item) => (
                      <button
                        type="button"
                        className="marketing-form__chip"
                        aria-pressed={jobType === item}
                        onClick={() => setJobType(item)}
                        key={item}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="marketing-form__choice">
                  <span className="marketing-form__label">Rough budget</span>
                  <div className="marketing-form__chips">
                    {budgets.map((item) => (
                      <button
                        type="button"
                        className="marketing-form__chip"
                        aria-pressed={budget === item}
                        onClick={() => setBudget(item)}
                        key={item}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="marketing-form__field">
                  <span className="marketing-form__label">Anything else</span>
                  <textarea
                    name="message"
                    rows="4"
                    placeholder="Timing, plans, style you are after"
                    required
                  />
                </label>

                <div className="marketing-form__actions">
                  <button
                    type="submit"
                    className="marketing-btn marketing-btn--dark"
                    disabled={submitStatus === "sending"}
                  >
                    {submitStatus === "sending" ? "Sending…" : "Send enquiry"}
                  </button>
                  <span className="marketing-form__note">
                    Your enquiry will be sent directly to the Ikonic workshop.
                  </span>
                </div>
              </form>
            </>
          )}
        </div>

        <aside
          className="marketing-contact__details"
          aria-label="Contact details"
        >
          {contactRows.map((row) => (
            <div className="marketing-contact__row" key={row.label}>
              <div className="marketing-contact__row-label">{row.label}</div>
              <div className="marketing-contact__row-value">
                {row.href ? (
                  <a
                    href={row.href}
                    target={row.external ? "_blank" : undefined}
                    rel={row.external ? "noopener noreferrer" : undefined}
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </div>
              <div className="marketing-contact__row-sub">{row.sub}</div>
            </div>
          ))}
        </aside>
      </div>
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
