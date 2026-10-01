import { notFound } from "next/navigation";
import MarketingShell from "@/components/marketing/MarketingShell";
import { CollectionPage } from "@/components/marketing/MarketingPages";
import { collectionBySlug, projects } from "@/data/marketing";

export function generateStaticParams() {
  return projects
    .filter((project) => project.slug !== "william-avenue-henley-beach")
    .map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const project = collectionBySlug[slug];

  if (!project || project.category !== "Projects") return {};

  return {
    title: `${project.title} | Ikonic Kitchens & Cabinets`,
    description: project.description,
  };
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const project = collectionBySlug[slug];

  if (!project || project.category !== "Projects") notFound();

  return (
    <MarketingShell>
      <CollectionPage collection={project} />
    </MarketingShell>
  );
}
