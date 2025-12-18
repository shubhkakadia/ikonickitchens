"use client";
import React from "react";
import GalleryPage from "@/components/gallerypage";

export default function page() {
  const laundryimages = [
    "/Gallery/Laundry/1.webp",
    "/Gallery/Laundry/2.webp",
    "/Gallery/Laundry/3.webp",
  ];
  return (
    <GalleryPage
      title="Laundry"
      description="Transform your laundry into a personal sanctuary with our expertly crafted designs. From modern minimalism to traditional elegance, we create spaces that inspire and rejuvenate."
      images={laundryimages}
    />
  );
}
