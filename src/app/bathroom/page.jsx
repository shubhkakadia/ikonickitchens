"use client";
import React from "react";
import GalleryPage from "@/components/gallerypage";

export default function page() {
  const bathroomimages = [
    "/Gallery/Bathroom/1.webp",
    "/Gallery/Bathroom/2.webp",
    "/Gallery/Bathroom/3.webp",
    "/Gallery/Bathroom/4.webp",
    "/Gallery/Bathroom/5.webp",
    "/Gallery/Bathroom/6.webp",
    "/Gallery/Bathroom/7.webp",
    "/Gallery/Bathroom/8.webp",
    "/Gallery/Bathroom/9.webp",
    "/Gallery/Bathroom/10.webp",
    "/Gallery/Bathroom/11.webp",
    "/Gallery/Bathroom/12.webp",
    "/Gallery/Bathroom/13.webp",
    "/Gallery/Bathroom/14.webp",
    "/Gallery/Bathroom/15.webp",
    "/Gallery/Bathroom/16.webp",
    "/Gallery/Bathroom/17.webp",
    "/Gallery/Bathroom/18.webp",
  ];
  return (
    <GalleryPage
      title="Bathroom"
      description="Transform your bathroom into a personal sanctuary with our expertly crafted designs. From modern minimalism to traditional elegance, we create spaces that inspire and rejuvenate."
      images={bathroomimages}
    />
  );
}
