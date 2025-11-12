"use client";
import React from "react";
import GalleryPage from "@/components/gallerypage";

export default function page() {
  const laundryimages = [
    "/Gallery/bathroom1.webp",
    "/Gallery/01.webp",
    "/Gallery/02.webp",
    "/Gallery/03.webp",
    "/Gallery/04.webp",
    "/Gallery/05.webp",
    "/Gallery/06.webp",
    "/Gallery/07.webp",
    "/Gallery/08.webp",
    "/Gallery/09.webp",
    "/Gallery/10.webp",
    "/Gallery/11.webp",
    "/Gallery/12.webp",
    "/Gallery/13.webp",
    "/Gallery/14.webp",
    "/Gallery/15.webp",
    "/Gallery/16.webp",
    "/Gallery/17.webp",
    "/Gallery/18.webp",
    "/Gallery/19.webp",
    "/Gallery/20.webp",
    "/Gallery/21.webp",
    "/Gallery/22.webp",
    "/Gallery/23.webp",
    "/Gallery/24.webp",
    "/Gallery/25.webp",
    "/Gallery/26.webp",
    "/Gallery/27.webp",
    "/Gallery/28.webp",
    "/Gallery/29.webp",
    "/Gallery/30.webp",
    "/Gallery/big13.webp",
  ];
  return (
    <GalleryPage
      title="Laundry"
      description="Transform your laundry into a personal sanctuary with our expertly crafted designs. From modern minimalism to traditional elegance, we create spaces that inspire and rejuvenate."
      images={laundryimages}
    />
  );
}
