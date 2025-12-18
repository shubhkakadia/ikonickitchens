"use client";
import React from "react";
import GalleryPage from "@/components/gallerypage";

export default function page() {
  const wardrobesimages = [
    "/Gallery/Wardrobe/1.webp",
    "/Gallery/Wardrobe/2.webp",
    "/Gallery/Wardrobe/3.webp",
  ];
  return (
    <GalleryPage
      title="Wardrobes"
      description="Transform your wardrobe into a personal sanctuary with our expertly crafted designs. From modern minimalism to traditional elegance, we create spaces that inspire and rejuvenate."
      images={wardrobesimages}
    />
  );
}
