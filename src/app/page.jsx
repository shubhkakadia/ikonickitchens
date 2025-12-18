"use client";

import Navbar from "@/components/Navbar";
import Image from "next/image";
import AOS from "aos";
import "aos/dist/aos.css";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Footer from "@/components/footer";

export default function Home() {
  // Hero carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // Gallery carousel state
  const [galleryCarouselIndex, setGalleryCarouselIndex] = useState(0);
  const thumbnailContainerRef = useRef(null);
  // Testimonials carousel state
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  // FAQ accordion state
  const [openFAQIndex, setOpenFAQIndex] = useState(null);

  // Selected images for carousel (5 images)
  const carouselImages = [
    "/Gallery/1.png",
    "/Gallery/2.png",
    "/Gallery/3.png",
    "/Gallery/4.webp",
    "/Gallery/5.webp",
  ];

  const carousel = [
    "/Gallery/Carousel/1.webp",
    "/Gallery/Carousel/2.webp",
    "/Gallery/Carousel/3.webp",
    "/Gallery/Carousel/4.webp",
    "/Gallery/Carousel/5.webp",
    "/Gallery/Carousel/6.webp",
    "/Gallery/Carousel/7.webp",
    "/Gallery/Carousel/8.webp",
    "/Gallery/Carousel/9.webp",
    "/Gallery/Carousel/10.webp",
    "/Gallery/Carousel/11.webp",
    "/Gallery/Carousel/12.webp",
    "/Gallery/Carousel/13.webp",
    "/Gallery/Carousel/14.webp",
    "/Gallery/Carousel/15.webp",
    "/Gallery/Carousel/16.webp",
    "/Gallery/Carousel/17.webp",
    "/Gallery/Carousel/18.webp",
    "/Gallery/Carousel/19.webp",
    "/Gallery/Carousel/20.webp",
    "/Gallery/Carousel/21.webp",
    "/Gallery/Carousel/22.webp",
    "/Gallery/Carousel/23.webp",
    "/Gallery/Carousel/24.webp",
    "/Gallery/Carousel/25.webp",
    "/Gallery/Carousel/26.webp",
    "/Gallery/Carousel/27.webp",
    "/Gallery/Carousel/28.webp",
    "/Gallery/Carousel/29.webp",
    "/Gallery/Carousel/30.webp",
  ]

  const testimonials = [
    {
      "name": "Michael Turner",
      "message": "We couldn't be happier with our new kitchen from Ikonic Kitchens & Cabinets. The workmanship is exceptional, the finishes are flawless, and the entire process was smooth from start to finish."
    },
    {
      "name": "Sarah Collins",
      "message": "Ikonic Kitchens & Cabinets delivered exactly what they promised. High-quality cabinetry, clear communication, and attention to detail that really stands out."
    },
    {
      "name": "Daniel Wright",
      "message": "From the initial consultation to the final installation, the team was professional and easy to work with. Our kitchen looks modern, functional, and beautifully crafted."
    },
    {
      "name": "Emma Richardson",
      "message": "The quality of the cabinets exceeded our expectations. Solid construction, premium materials, and a perfect fit. You can really see the craftsmanship."
    },
    {
      "name": "James Wilson",
      "message": "We had custom cabinetry built for our kitchen and laundry, and the results are outstanding. Smart storage solutions and a high-end finish throughout."
    },
    {
      "name": "Olivia Bennett",
      "message": "Ikonic Kitchens & Cabinets transformed our outdated kitchen into a space we genuinely love. The team listened carefully and delivered exactly what we wanted."
    },
    {
      "name": "Andrew Thompson",
      "message": "Reliable, skilled, and professional. The project was completed on time and within budget without compromising on quality."
    },
    {
      "name": "Priya Shah",
      "message": "The attention to detail in the cabinetry is impressive. Every drawer, hinge, and finish feels premium. We are extremely satisfied with the result."
    },
    {
      "name": "Matthew O'Connor",
      "message": "We appreciated the honest advice and custom solutions provided. The final outcome looks fantastic and works perfectly for our space."
    },
    {
      "name": "Lauren Mitchell",
      "message": "If you're looking for quality custom cabinetry, Ikonic Kitchens & Cabinets are the people to call. Excellent workmanship and a team that truly cares."
    }
  ]

  const faq = [
    {
      "question": "Do you offer custom kitchen and cabinetry designs?",
      "answer": "Yes, we specialise in fully custom kitchen and cabinetry solutions. Every project is designed to suit your space, style, and functional requirements."
    },
    {
      "question": "What types of cabinetry do you make?",
      "answer": "We design and manufacture kitchen cabinets, wardrobes, laundries, bathroom vanities, storage units, and other custom cabinetry for residential and commercial spaces."
    },
    {
      "question": "Do you handle the entire project from design to installation?",
      "answer": "Yes, we manage the complete process including design consultation, manufacturing, and professional installation to ensure a seamless experience."
    },
    {
      "question": "How long does a typical kitchen or cabinetry project take?",
      "answer": "Timelines vary depending on project size and complexity, but most projects are completed within a few weeks once the design is finalised and approved."
    },
    {
      "question": "Do you work with builders or designers?",
      "answer": "Yes, we regularly work with builders, renovators, interior designers, and architects on both residential and commercial projects."
    },
    {
      "question": "Can you customise cabinetry for small or unusual spaces?",
      "answer": "Absolutely. Custom cabinetry is ideal for maximising storage and functionality in small, narrow, or uniquely shaped spaces."
    },
  ]



  const aboutusdata = [
    {
      imageurl: "/mission.webp",
      title: "Our Mission",
      description:
        "Our mission is to provide our customers with the highest quality kitchen cabinets and unparalleled customer service. We believe that every homeowner deserves the kitchen of their dreams, and we are committed to making that a reality.",
      delay: 200,
    },
    {
      imageurl: "/expertise.webp",
      title: "Our Expertise",
      description:
        "Our team of experts has undebatable experience in the industry. We stay up to date with the latest trends and techniques to ensure that we are providing our customers with the best possible products and services.",
      delay: 400,
    },
    {
      imageurl: "/product.webp",
      title: "Our Products",
      description:
        "We are proud to offer a wide selection of cabinets in various styles, colours, and finishes. From traditional to modern, we have something to match every design aesthetic, to help bring your visions to life.",
      delay: 600,
    },
  ];

  useEffect(() => {
    AOS.init({ duration: 1000, once: true });
  }, []);

  // Auto-play hero carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === carouselImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 4000); // Change image every 4 seconds

    return () => clearInterval(interval);
  }, [carouselImages.length]);

  // Auto-play gallery carousel (3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setGalleryCarouselIndex((prevIndex) =>
        prevIndex === carousel.length - 1 ? 0 : prevIndex + 1
      );
    }, 3000); // Change image every 3 seconds

    return () => clearInterval(interval);
  }, [carousel.length]);

  // Function to go to specific image (hero)
  const goToImage = (index) => {
    setCurrentImageIndex(index);
  };

  // Gallery carousel navigation functions
  const nextGalleryImage = () => {
    setGalleryCarouselIndex((prevIndex) =>
      prevIndex === carousel.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevGalleryImage = () => {
    setGalleryCarouselIndex((prevIndex) =>
      prevIndex === 0 ? carousel.length - 1 : prevIndex - 1
    );
  };

  const goToGalleryImage = (index) => {
    setGalleryCarouselIndex(index);
  };

  // Thumbnail navigation functions
  const scrollThumbnailsLeft = () => {
    if (thumbnailContainerRef.current) {
      const scrollAmount = 200; // Scroll by 200px
      thumbnailContainerRef.current.scrollBy({
        left: -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollThumbnailsRight = () => {
    if (thumbnailContainerRef.current) {
      const scrollAmount = 200; // Scroll by 200px
      thumbnailContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Auto-play testimonials carousel (5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setTestimonialIndex((prevIndex) =>
        prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
      );
    }, 10000); // Change testimonial every 10 seconds

    return () => clearInterval(interval);
  }, [testimonials.length]);

  // Testimonials navigation functions
  const nextTestimonial = () => {
    setTestimonialIndex((prevIndex) =>
      prevIndex === testimonials.length - 1 ? 0 : prevIndex + 1
    );
  };

  const prevTestimonial = () => {
    setTestimonialIndex((prevIndex) =>
      prevIndex === 0 ? testimonials.length - 1 : prevIndex - 1
    );
  };

  // FAQ toggle function
  const toggleFAQ = (index) => {
    setOpenFAQIndex(openFAQIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="relative h-screen overflow-hidden">
        <Navbar />
        {/* Animated Background Carousel */}
        <div className="absolute inset-0 bg-linear-to-r from-slate-900/80 to-slate-800/60">
          {/* Carousel Images */}
          <div className="absolute inset-0 overflow-hidden">
            {carouselImages.map((image, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? "opacity-100" : "opacity-0"
                  }`}
              >
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                  style={{ backgroundImage: `url('${image}')` }}
                ></div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-linear-to-r from-slate-900/70 to-transparent"></div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 h-full flex items-center">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl">
              <div
                className="space-y-6 sm:space-y-8"
                data-aos="fade-up"
                data-aos-delay="200"
              >
                <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-white/80 leading-tight">
                  ELEVATE YOUR SPACE WITH
                  <span className="block text-[#B92F34]/80">
                    QUALITY CABINETS
                  </span>
                </h1>
                <p className="text-base sm:text-lg lg:text-2xl text-slate-200 max-w-2xl leading-relaxed">
                  Discover our premium selection of custom kitchen cabinets,
                  wardrobes, and home solutions designed to transform your
                  living space.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
                  <Link
                    href="/inquiries"
                    className="cursor-pointer bg-[#B92F34]/80 hover:bg-[#A0252A]/80 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg w-full sm:w-auto"
                  >
                    Get Free Quote
                  </Link>
                  <Link
                    href="/gallery"
                    className="cursor-pointer border-2 border-white text-white hover:bg-white/80 hover:text-slate-900 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all duration-300 w-full sm:w-auto"
                  >
                    View Gallery
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex space-x-3">
            {carouselImages.map((_, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`cursor-pointer w-3 h-3 rounded-full transition-all duration-300 ${index === currentImageIndex
                  ? "bg-white scale-125"
                  : "bg-white/50 hover:bg-white/75"
                  }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 animate-bounce z-20">
          <div className="w-6 h-10 border-2 border-white rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      <div className="bg-linear-to-r from-slate-800 to-slate-900 py-16 sm:py-20 lg:py-24">
        <div className="container mx-auto px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16" data-aos="fade-up">
            <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white mb-4">
              Trusted by <span className="text-[#B92F34]">Hundreds</span> of
              Happy Customers
            </h2>
            <p className="text-base sm:text-lg text-slate-300 max-w-3xl mx-auto">
              Our track record speaks for itself. Here's what we've achieved
              together.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 lg:gap-16">
            {/* Years of Experience */}
            <div
              className="text-center group"
              data-aos="fade-up"
              data-aos-delay="200"
            >
              <div className="relative inline-block mb-4 sm:mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-linear-to-br from-[#B92F34] to-[#A0252A] rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500 shadow-lg group-hover:shadow-2xl">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white group-hover:text-[#B92F34] transition-colors duration-300">
                  2+
                </div>
                <div className="text-sm sm:text-base lg:text-lg text-slate-300 font-medium">
                  Years of Experience
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  Delivering Excellence
                </div>
              </div>
            </div>

            {/* Projects Completed */}
            <div
              className="text-center group"
              data-aos="fade-up"
              data-aos-delay="400"
            >
              <div className="relative inline-block mb-4 sm:mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-linear-to-br from-[#B92F34] to-[#A0252A] rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500 shadow-lg group-hover:shadow-2xl">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white group-hover:text-[#B92F34] transition-colors duration-300">
                  100+
                </div>
                <div className="text-sm sm:text-base lg:text-lg text-slate-300 font-medium">
                  Projects Completed
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  Successfully Delivered
                </div>
              </div>
            </div>

            {/* Customer Satisfaction */}
            <div
              className="text-center group"
              data-aos="fade-up"
              data-aos-delay="600"
            >
              <div className="relative inline-block mb-4 sm:mb-6">
                <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-linear-to-br from-[#B92F34] to-[#A0252A] rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500 shadow-lg group-hover:shadow-2xl">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white group-hover:text-[#B92F34] transition-colors duration-300">
                  99%
                </div>
                <div className="text-sm sm:text-base lg:text-lg text-slate-300 font-medium">
                  Customer Satisfaction
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  Happy Clients
                </div>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div
            className="text-center mt-12 sm:mt-16"
            data-aos="fade-up"
            data-aos-delay="800"
          >
            <p className="text-base sm:text-lg text-slate-300 mb-6 sm:mb-8">
              Ready to be our next success story?
            </p>
            <Link
              href="/inquiries"
              className="inline-flex items-center bg-[#B92F34] hover:bg-[#A0252A] text-white px-8 sm:px-10 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Start Your Project Today
              <svg
                className="ml-2 w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <div>
        <div className="container mx-auto px-6 lg:px-8 space-y-12 py-12">
          <div className="text-center space-y-12 sm:space-y-16">
            <div className="space-y-4 sm:space-y-6" data-aos="fade-up">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-800">
                Why Choose{" "}
                <span className="text-[#B92F34]">
                  Ikonic Kitchens and Cabinets
                </span>
                ?
              </h2>
              <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto px-4">
                We combine decades of expertise with cutting-edge design to
                deliver exceptional kitchen and cabinet solutions that exceed
                your expectations.
              </p>
            </div>

            {/* About Us Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {aboutusdata.map((item) => (
                <div
                  key={item.title}
                  data-aos="fade-up"
                  data-aos-delay={item.delay}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 overflow-hidden"
                >
                  <div className="relative h-48 sm:h-56 lg:h-64 overflow-hidden">
                    <Image
                      loading="lazy"
                      src={item.imageurl}
                      alt={item.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent"></div>
                  </div>
                  <div className="p-4 sm:p-6 lg:p-8">
                    <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800 mb-3 sm:mb-4 group-hover:text-[#B92F34] transition-colors duration-300">
                      {item.title}
                    </h3>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gallery Carousel Section */}
          <div className="w-full py-12" data-aos="fade-up">
            <div className="text-center space-y-4 mb-8 sm:mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-800">
                Our <span className="text-[#B92F34]">Gallery</span>
              </h2>
              <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto px-4">
                Browse through our collection of stunning kitchen and cabinet designs
              </p>
            </div>

            {/* Main Carousel */}
            <div className="relative max-w-7xl mx-auto px-4">
              <div className="group relative aspect-video rounded-2xl overflow-hidden shadow-2xl bg-slate-900">
                {/* Main Image */}
                <div className="relative w-full h-full">
                  {carousel.map((image, index) => (
                    <div
                      key={index}
                      className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${index === galleryCarouselIndex ? "opacity-100" : "opacity-0"
                        }`}
                    >
                      <Image
                        src={image}
                        alt={`Gallery image ${index + 1}`}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 80vw"
                        priority={index === galleryCarouselIndex}
                      />
                    </div>
                  ))}
                </div>

                {/* Previous Button - Hidden by default, shown on hover */}
                <button
                  onClick={prevGalleryImage}
                  className="cursor-pointer absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-slate-800 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 opacity-0 group-hover:opacity-100"
                  aria-label="Previous image"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Next Button - Hidden by default, shown on hover */}
                <button
                  onClick={nextGalleryImage}
                  className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-slate-800 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110 opacity-0 group-hover:opacity-100"
                  aria-label="Next image"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Image Counter */}
                <div className="absolute bottom-4 right-4 z-10 text-white px-4 py-2 rounded-full text-sm font-medium">
                  {galleryCarouselIndex + 1} / {carousel.length}
                </div>
              </div>

              {/* Thumbnails - Single row with navigation */}
              <div className="p-4 relative">
                {/* Left Navigation Button */}
                <button
                  onClick={scrollThumbnailsLeft}
                  className="cursor-pointer absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
                  aria-label="Scroll thumbnails left"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                {/* Right Navigation Button */}
                <button
                  onClick={scrollThumbnailsRight}
                  className="cursor-pointer absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
                  aria-label="Scroll thumbnails right"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                {/* Thumbnail Container */}
                <div
                  ref={thumbnailContainerRef}
                  className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide px-8 py-4"
                  style={{ scrollBehavior: 'smooth' }}
                >
                  {carousel.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => goToGalleryImage(index)}
                      className={`cursor-pointer shrink-0 relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden border-2 transition-all duration-300 ${index === galleryCarouselIndex
                        ? "border-[#B92F34] ring-1 ring-[#B92F34] scale-110"
                        : "border-slate-300 hover:border-slate-400 opacity-70 hover:opacity-100"
                        }`}
                      aria-label={`Go to image ${index + 1}`}
                    >
                      <Image
                        src={image}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 80px, 96px"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Product Showcase */}
          <div className="w-full">
            <div
              className="text-center space-y-4 mb-12 sm:mb-16"
              data-aos="fade-up"
            >
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-800">
                Our Premium <span className="text-[#B92F34]">Collections</span>
              </h2>
              <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto px-4">
                Explore our carefully curated selection of premium cabinet
                materials and finishes, each designed to bring your vision to
                life.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {/* Polytec */}
              <div className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                <a
                  href="https://www.polytec.com.au/colours/"
                  target="_blank"
                  className="block h-64 sm:h-80 lg:h-96"
                >
                  <Image
                    loading="lazy"
                    src="/Polytec.jpg"
                    alt="Polytec Collection"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2 sm:space-y-4 px-4">
                      <h3 className="font-extralight text-white text-xl sm:text-2xl lg:text-4xl opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                        POLYTEC
                      </h3>
                      <p className="text-white/90 text-sm sm:text-base lg:text-lg opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                        Premium Laminate Collection
                      </p>
                    </div>
                  </div>
                </a>
              </div>

              {/* Laminex */}
              <div className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                <a
                  href="https://www.laminex.com.au/browse"
                  target="_blank"
                  className="block h-64 sm:h-80 lg:h-96"
                >
                  <Image
                    loading="lazy"
                    src="/Laminex.jpg"
                    alt="Laminex Collection"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2 sm:space-y-4 px-4">
                      <h3 className="text-white font-extralight text-xl sm:text-2xl lg:text-4xl opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                        LAMINEX
                      </h3>
                      <p className="text-white/90 text-sm sm:text-base lg:text-lg opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                        High-Pressure Laminate
                      </p>
                    </div>
                  </div>
                </a>
              </div>

              {/* Australian Timber */}
              <div className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                <a
                  href="https://www.australiantimbers.com.au/products/"
                  target="_blank"
                  className="block h-64 sm:h-80 lg:h-96"
                >
                  <Image
                    loading="lazy"
                    src="/AustralianTimber.jpg"
                    alt="Australian Timber Collection"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2 sm:space-y-4 px-4">
                      <h3 className="text-white font-extralight text-xl sm:text-2xl lg:text-4xl opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                        AUSTRALIAN TIMBER
                      </h3>
                      <p className="text-white/90 text-sm sm:text-base lg:text-lg opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                        Natural Wood Finishes
                      </p>
                    </div>
                  </div>
                </a>
              </div>

              {/* Acrilam */}
              <div className="relative group cursor-pointer overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2">
                <a
                  href="https://acrilam.com.au/products/"
                  target="_blank"
                  className="block h-64 sm:h-80 lg:h-96"
                >
                  <Image
                    loading="lazy"
                    src="/Acrilam.jpg"
                    alt="Acrilam Collection"
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2 sm:space-y-4 px-4">
                      <h3 className="text-white font-extralight text-xl sm:text-2xl lg:text-4xl opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                        ACRILAM
                      </h3>
                      <p className="text-white/90 text-sm sm:text-base lg:text-lg opacity-0 group-hover:opacity-100 transition-all duration-500 delay-100 transform translate-y-4 group-hover:translate-y-0">
                        Acrylic Laminate
                      </p>
                    </div>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="w-full py-12 sm:py-16 lg:py-20" data-aos="fade-up">
            <div className="text-center space-y-4 mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-800">
                Frequently Asked <span className="text-[#B92F34]">Questions</span>
              </h2>
              <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto px-4">
                Find answers to common questions about our kitchen and cabinetry services
              </p>
            </div>

            <div className="max-w-4xl mx-auto px-4">
              <div className="space-y-4">
                {faq.map((item, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg"
                  >
                    {/* Question Button */}
                    <button
                      onClick={() => toggleFAQ(index)}
                      className="cursor-pointer w-full px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between text-left focus:outline-none"
                      aria-expanded={openFAQIndex === index}
                      aria-controls={`faq-answer-${index}`}
                    >
                      <span className="text-base sm:text-lg font-semibold text-slate-800 pr-4">
                        {item.question}
                      </span>
                      <svg
                        className={`w-5 h-5 sm:w-6 sm:h-6 text-[#B92F34] shrink-0 transition-transform duration-300 ${openFAQIndex === index ? "rotate-180" : ""
                          }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {/* Answer */}
                    <div
                      id={`faq-answer-${index}`}
                      className={`overflow-hidden transition-all duration-300 ${openFAQIndex === index
                          ? "max-h-96 opacity-100"
                          : "max-h-0 opacity-0"
                        }`}
                    >
                      <div className="px-6 sm:px-8 pb-4 sm:pb-5">
                        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Testimonials Carousel */}
          <div className="w-full sm:py-16 lg:py-20" data-aos="fade-up">
            <div className="text-center space-y-4 mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-slate-800">
                What Our <span className="text-[#B92F34]">Customers</span> Say
              </h2>
              <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto px-4">
                Don't just take our word for it - hear from our satisfied customers
              </p>
            </div>

            <div className="relative max-w-4xl mx-auto px-4">
              {/* Testimonials Container */}
              <div className="relative bg-white rounded-2xl shadow-xl p-8 sm:p-12 lg:p-16 min-h-[400px] flex items-center">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={index}
                    className={`absolute inset-0 p-8 sm:p-12 lg:p-16 transition-opacity duration-700 ease-in-out ${index === testimonialIndex ? "opacity-100" : "opacity-0"
                      }`}
                  >
                    <div className="flex flex-col items-center text-center space-y-6">
                      {/* Quote Icon */}
                      <svg
                        className="w-12 h-12 text-[#B92F34] opacity-30"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.984zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h4v10h-10z" />
                      </svg>

                      {/* Testimonial Message */}
                      <p className="text-lg sm:text-xl lg:text-2xl text-slate-700 leading-relaxed italic max-w-3xl">
                        "{testimonial.message}"
                      </p>

                      {/* Customer Name */}
                      <div className="pt-4">
                        <p className="text-base sm:text-lg font-semibold text-slate-800">
                          - {testimonial.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Previous Button */}
              <button
                onClick={prevTestimonial}
                className="cursor-pointer absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-[#B92F34] text-slate-800 hover:text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
                aria-label="Previous testimonial"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Next Button */}
              <button
                onClick={nextTestimonial}
                className="cursor-pointer absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-[#B92F34] text-slate-800 hover:text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
                aria-label="Next testimonial"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>

              {/* Testimonial Indicators */}
              <div className="flex justify-center space-x-2 mt-8">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setTestimonialIndex(index)}
                    className={`cursor-pointer w-2 h-2 rounded-full transition-all duration-300 ${index === testimonialIndex
                      ? "bg-[#B92F34] w-8"
                      : "bg-slate-300 hover:bg-slate-400"
                      }`}
                    aria-label={`Go to testimonial ${index + 1}`}
                  />
                ))}
              </div>

              {/* Testimonial Counter */}
              <div className="text-center mt-4 text-sm text-slate-500">
                {testimonialIndex + 1} / {testimonials.length}
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </div>
  );
}
