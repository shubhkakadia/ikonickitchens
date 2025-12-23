"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/footer";

export default function BlogsPage() {
  // Blog posts data
  const blogs = [
    {
      id: 1,
      slug: "How_much_does_a_custom_kitchen_cost_in_Australia",
      title: "How Much Does a Custom Kitchen Cost in Australia?",
      subtitle: "A comprehensive guide to understanding custom kitchen pricing and what affects the cost",
      date: new Date("2025-12-18"),
      readTime: "5 min read",
    },
    {
      id: 2,
      slug: "What_is_the_difference_between_custom_cabinets_and_modular_cabinets",
      title: "What Is the Difference Between Custom Cabinets and Modular Cabinets?",
      subtitle: "Understanding the key differences to help you make the right choice for your kitchen renovation",
      date: new Date("2025-12-18"),
      readTime: "6 min read",
    },
    {
      id: 3,
      slug: "How_long_does_it_take_to_build_and_install_a_custom_kitchen",
      title: "How Long Does It Take to Build and Install a Custom Kitchen?",
      subtitle: "Understanding the typical timeline for designing, building, and installing a custom kitchen",
      date: new Date("2025-12-18"),
      readTime: "5 min read",
    },
    // Add more blogs here as they are created
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Page Header */}
        <div className="bg-linear-to-r from-gray-900 to-gray-800 text-white pb-16 pt-32">
          <div className="container mx-auto px-4 max-w-7xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-center">
              Our Blog
            </h1>
            <p className="text-gray-300 text-lg text-center max-w-2xl mx-auto">
              Expert insights, tips, and guides for your kitchen, bathroom, laundry, and wardrobe projects
            </p>
          </div>
        </div>

        {/* Blogs Grid */}
        <div className="container mx-auto px-4 py-16 max-w-7xl">
          {blogs.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">No blog posts available yet. Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogs.map((blog, index) => (
                <Link
                  key={blog.id}
                  href={`/blogs/${blog.slug}`}
                  className="bg-white rounded-xl shadow-lg overflow-hidden card-hover cursor-pointer group transition-all duration-300 hover:shadow-xl"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {/* Blog Card Content */}
                  <div className="h-full flex flex-col">
                    {/* Optional: Image placeholder or actual image */}
                    <div className="relative h-48 bg-linear-to-br from-gray-200 to-gray-300 overflow-hidden">
                      <div className="absolute inset-0 bg-linear-to-br from-[#B92F34]/10 to-gray-900/20 group-hover:from-[#B92F34]/20 group-hover:to-gray-900/30 transition-all duration-300" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="w-16 h-16 text-gray-400 group-hover:text-[#B92F34] transition-colors duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Blog Info */}
                    <div className="p-6 flex-1 flex flex-col">
                      <h2 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#B92F34] transition-colors duration-300 line-clamp-2">
                        {blog.title}
                      </h2>

                      <p className="text-gray-600 text-sm mb-4 line-clamp-3 flex-1">
                        {blog.subtitle}
                      </p>

                      {/* Date and Read Time */}
                      <div className="flex flex-wrap items-center gap-4 text-gray-500 text-xs pt-4 border-t border-gray-200">
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {blog.date.toLocaleDateString('en-AU', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {blog.readTime}
                        </span>
                      </div>

                      {/* Read More Link */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <span className="text-[#B92F34] font-semibold text-sm group-hover:text-[#A0252A] transition-colors duration-300 flex items-center gap-2">
                          Read More
                          <svg
                            className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300"
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
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
