export default function LegalPage({
  kicker = "Legal",
  title,
  updated,
  intro,
  sections,
  children,
}) {
  return (
    <div className="marketing-page marketing-container marketing-legal">
      <div className="marketing-eyebrow">{kicker}</div>
      <h1 className="marketing-display">{title}</h1>
      <div className="marketing-legal__updated">{updated}</div>
      <div className="marketing-legal__layout">
        <p className="marketing-legal__intro">{intro}</p>
        <div>
          {sections.map((section) => (
            <section className="marketing-legal__section" key={section.title}>
              <h2>{section.title}</h2>
              {section.content}
            </section>
          ))}
          {children}
        </div>
      </div>
    </div>
  );
}
