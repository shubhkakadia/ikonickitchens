"use client";
import React from "react";
import GalleryPage from "@/components/gallerypage";

export default function page() {
  const kitchensimages = [
    "/Gallery/Kitchen/1.webp",
    "/Gallery/Kitchen/2.webp",
    "/Gallery/Kitchen/3.webp",
    "/Gallery/Kitchen/4.webp",
    "/Gallery/Kitchen/5.webp",
    "/Gallery/Kitchen/6.webp",
    "/Gallery/Kitchen/7.webp",
    "/Gallery/Kitchen/8.webp",
    "/Gallery/Kitchen/9.webp",
    "/Gallery/Kitchen/10.webp",
    "/Gallery/Kitchen/11.webp",
    "/Gallery/Kitchen/12.webp",
    "/Gallery/Kitchen/13.webp",
    "/Gallery/Kitchen/14.webp",
    "/Gallery/Kitchen/15.webp",
    "/Gallery/Kitchen/16.webp",
    "/Gallery/Kitchen/17.webp",
    "/Gallery/Kitchen/18.webp",
  ];
  return (
    <GalleryPage
      title="Kitchens"
      description="Transform your kitchen into a personal sanctuary with our expertly crafted designs. From modern minimalism to traditional elegance, we create spaces that inspire and rejuvenate."
      images={kitchensimages}
    />
  );
}
