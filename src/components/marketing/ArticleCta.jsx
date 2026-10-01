import Link from "next/link";

export default function ArticleCta({ title, description }) {
  return (
    <section className="marketing-container marketing-article-cta-wrap">
      <div className="marketing-article-cta">
        <div>
          <div className="marketing-eyebrow">Start a conversation</div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <div className="marketing-article-cta__actions">
          <Link
            href="/inquiries"
            className="marketing-btn marketing-btn--light"
          >
            Request a quote
          </Link>
          <Link href="/kitchens" className="marketing-article-cta__link">
            View our kitchens →
          </Link>
        </div>
      </div>
    </section>
  );
}
