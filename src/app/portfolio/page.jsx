"use client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Carousel from "@/components/Carousel";
import Image from "next/image";
import React, { useState } from "react";
import Link from "next/link";

export default function page() {
  const [selectedProject, setSelectedProject] = useState(null);

  const galleryData = [
    {
      id: 1,
      address: "18 William Avenue, Henley Beach",
      images: [
        "/18 William Avenue/image01.jpg",
        "/18 William Avenue/image02.jpg",
        "/18 William Avenue/image03.jpg",
        "/18 William Avenue/image04.jpg",
        "/18 William Avenue/image05.jpg",
        "/18 William Avenue/image06.jpg",
        "/18 William Avenue/image07.jpg",
        "/18 William Avenue/image08.jpg",
        "/18 William Avenue/image09.jpg",
        "/18 William Avenue/image10.jpg",
        "/18 William Avenue/image11.jpg",
        "/18 William Avenue/image12.jpg",
        "/18 William Avenue/image13.jpg",
        "/18 William Avenue/image14.jpg",
        "/18 William Avenue/image15.jpg",
        "/18 William Avenue/image16.jpg",
      ],
    },
  ];

  const handleProjectClick = (project) => {
    setSelectedProject(project);
    // Scroll to carousel
    document.getElementById("carousel-section")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 ">
      <Navbar bar={true} />

      {/* Hero Section */}
      <div className="pt-32 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 animate-fadeInUp">
            Our <span className="text-gradient">Portfolio</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-12 animate-fadeInUp">
            Discover our portfolio of stunning kitchen, bathroom, laundry, and
            wardrobe designs. Each project showcases our commitment to quality
            craftsmanship and innovative design.
          </p>
        </div>
      </div>

      {/* Carousel Section */}
      <div id="carousel-section" className="px-4 mb-16">
        <div className="max-w-7xl mx-auto">
          {selectedProject ? (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6"></div>
              <Carousel
                images={selectedProject.images}
                projectTitle={selectedProject.address}
              />
            </div>
          ) : (
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Select a Project to View
              </h2>
              <p className="text-gray-600">
                Click on any project below to explore its gallery
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="px-4 pb-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Our Projects
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {galleryData.map((project, index) => (
              <div
                key={project.id}
                className="bg-white rounded-xl shadow-lg overflow-hidden card-hover cursor-pointer group"
                onClick={() => handleProjectClick(project)}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Project Image */}
                <div className="relative h-64 overflow-hidden">
                  <Image
                    loading="lazy"
                    src={project.images[0]}
                    alt={project.address}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />

                  {/* Image Count Badge */}
                  <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded-full text-sm font-medium">
                    {project.images.length} photos
                  </div>
                </div>

                {/* Project Info */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-[#B92F34] transition-colors duration-300">
                    {project.address}
                  </h3>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      Project #{project.id}
                    </span>
                    <button className="text-[#B92F34] font-semibold group-hover:text-[#A0252A] transition-colors duration-300">
                      View Gallery →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-[#B92F34] to-[#A0252A] py-16 px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Start Your Project?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Let us bring your vision to life with our expert craftsmanship and
            design expertise.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/inquiries"
              className="border-2 border-white text-white hover:bg-white hover:text-[#B92F34] font-semibold py-4 px-8 rounded-lg transition-all duration-300"
            >
              Book Consultation
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
