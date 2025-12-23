"use client";

import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/footer";

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        {/* Blog Header */}
        <div className="bg-linear-to-r from-gray-900 to-gray-800 text-white pb-16 pt-32">
          <div className="container mx-auto px-4 max-w-4xl">
            {/* Back Button */}
            <Link
              href="/blogs"
              className="inline-flex items-center gap-2 text-gray-300 hover:text-white mb-6 transition-colors duration-300 group"
            >
              <svg
                className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform duration-300"
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
              <span className="font-medium">Back to Blogs</span>
            </Link>

            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              What Is the Difference Between Custom Cabinets and Modular Cabinets?
            </h1>
            <p className="text-gray-300 text-lg mb-4">
              Understanding the key differences to help you make the right choice for your kitchen renovation
            </p>
            <div className="flex flex-wrap items-center gap-4 text-gray-400 text-sm">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date().toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ~6 min read
              </span>
            </div>
          </div>
        </div>

        {/* Blog Content */}
        <article className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="prose prose-lg max-w-none">
            {/* Introduction */}
            <section className="mb-12">
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                When planning a kitchen renovation or new build, one of the most important decisions you'll make is choosing between custom cabinets and modular cabinets. While both options serve the same basic purpose, the differences in quality, flexibility, cost, and long-term value are significant.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                Understanding these differences will help you make an informed decision that suits your home, lifestyle, and budget.
              </p>
            </section>

            {/* What Are Custom Cabinets Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                What Are Custom Cabinets?
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                Custom cabinets are designed and built specifically for your space. Every measurement, material, finish, and storage feature is tailored to your kitchen layout and personal requirements. These cabinets are typically manufactured by professional cabinet makers and installed by experienced tradespeople.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                Because they are made to order, custom cabinets offer complete flexibility in design and functionality.
              </p>
            </section>

            {/* What Are Modular Cabinets Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                What Are Modular Cabinets?
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                Modular cabinets, also known as flat-pack or pre-manufactured cabinets, are produced in standard sizes and configurations. They are mass-manufactured and then assembled on site or delivered ready to install.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                Modular cabinets are often chosen for their lower upfront cost and faster availability, but they come with design and quality limitations.
              </p>
            </section>

            {/* Key Differences Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Key Differences Between Custom Cabinets and Modular Cabinets
              </h2>

              {/* Difference 1 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  1. Design Flexibility
                </h3>

                <div className="mb-4">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Custom cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed mb-4">
                    Custom cabinetry allows complete design freedom. Cabinet sizes, depths, heights, and layouts are tailored precisely to your kitchen. This is ideal for:
                  </p>
                  <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                    <li>Small or awkward spaces</li>
                    <li>Older homes with uneven walls</li>
                    <li>Unique layouts or architectural features</li>
                    <li>Specific storage requirements</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Modular cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed mb-4">
                    Modular cabinets come in fixed sizes. This can result in:
                  </p>
                  <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                    <li>Unused gaps or filler panels</li>
                    <li>Reduced storage efficiency</li>
                    <li>Limited layout options</li>
                  </ul>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    If your kitchen doesn't perfectly match standard dimensions, modular cabinetry may feel restrictive.
                  </p>
                </div>
              </div>

              {/* Difference 2 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  2. Quality and Durability
                </h3>

                <div className="mb-4">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Custom cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed mb-4">
                    Custom cabinets are typically built using high-quality materials such as moisture-resistant MDF, plywood, timber veneer, or solid timber. Hardware like soft-close hinges and drawer runners is chosen for durability and daily use.
                  </p>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    With proper care, custom cabinetry can last 20–30 years or more.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Modular cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Modular cabinets often use thinner materials and basic hardware to keep costs low. While they can look good initially, they may wear faster, especially in high-use kitchens.
                  </p>
                  <p className="text-gray-700 text-lg leading-relaxed mt-2">
                    Durability can vary greatly depending on the brand and price point.
                  </p>
                </div>
              </div>

              {/* Difference 3 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  3. Storage and Functionality
                </h3>

                <div className="mb-4">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Custom cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed mb-4">
                    Custom cabinetry is designed around how you use your kitchen. This allows for:
                  </p>
                  <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                    <li>Custom drawer configurations</li>
                    <li>Pull-out pantries</li>
                    <li>Corner storage solutions</li>
                    <li>Integrated bins and appliance housing</li>
                  </ul>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Everything is built with functionality in mind.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Modular cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Modular kitchens offer limited storage customisation. While accessories can be added, they are constrained by standard cabinet sizes and layouts.
                  </p>
                  <p className="text-gray-700 text-lg leading-relaxed mt-2">
                    This often results in less efficient storage and reduced usability.
                  </p>
                </div>
              </div>

              {/* Difference 4 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  4. Fit and Finish
                </h3>

                <div className="mb-4">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Custom cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Because custom cabinets are built specifically for your space, the fit is precise. Cabinets align cleanly with walls, ceilings, and appliances, creating a seamless, premium look.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Modular cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Modular cabinets may require filler panels to compensate for size mismatches. While this is common, it can affect both appearance and storage capacity.
                  </p>
                </div>
              </div>

              {/* Difference 5 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  5. Cost Comparison
                </h3>

                <div className="mb-4">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Custom cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed mb-4">
                    Custom cabinets generally cost more upfront due to:
                  </p>
                  <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                    <li>Tailored design</li>
                    <li>Higher-quality materials</li>
                    <li>Skilled craftsmanship</li>
                  </ul>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    However, they often provide better long-term value due to durability and functionality.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Modular cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed mb-4">
                    Modular cabinets are usually more affordable initially and may suit:
                  </p>
                  <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                    <li>Tight budgets</li>
                    <li>Investment properties</li>
                    <li>Short-term renovations</li>
                  </ul>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    It's important to factor in lifespan and potential replacement costs when comparing prices.
                  </p>
                </div>
              </div>

              {/* Difference 6 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  6. Installation Process
                </h3>

                <div className="mb-4">
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Custom cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Installation is handled by experienced cabinet installers who ensure everything fits perfectly. This reduces the risk of issues and ensures a professional finish.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold text-gray-800 mb-3">Modular cabinets</h4>
                  <p className="text-gray-700 text-lg leading-relaxed">
                    Modular cabinets may be installed by builders or general installers. Assembly quality can vary depending on experience and attention to detail.
                  </p>
                </div>
              </div>
            </section>

            {/* Which Option Is Right Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Which Option Is Right for You?
              </h2>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Custom cabinets are ideal if:</h3>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>You want a high-quality, long-term solution</li>
                    <li>Your kitchen has a unique layout</li>
                    <li>You value functionality and premium finishes</li>
                    <li>You want to maximise storage and usability</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Modular cabinets may suit you if:</h3>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>You are working with a strict budget</li>
                    <li>Your kitchen layout is simple and standard</li>
                    <li>The project is short-term or for resale</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Final Thoughts Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Final Thoughts
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                The difference between custom cabinets and modular cabinets comes down to flexibility, quality, and long-term value. While modular cabinets may offer a lower upfront cost, custom cabinetry provides a tailored solution that enhances daily living and adds lasting value to your home.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                If you're investing in a kitchen you plan to use and enjoy for many years, custom cabinets are often the smarter choice.
              </p>
            </section>
          </div>
        </article>

        {/* Call to Action Section */}
        <div className="bg-linear-to-r from-[#B92F34] to-[#A0252A] py-16 px-4">
          <div className="container mx-auto max-w-4xl text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Choose the Right Cabinets for Your Kitchen?
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Get expert advice on whether custom or modular cabinets are right for your project. Our experienced team will help you understand the options, compare costs, and make the best decision for your home.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/inquiries"
                className="border-2 border-white text-white hover:bg-white hover:text-[#B92F34] font-semibold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                Get Free Quote
              </Link>
              <Link
                href="/kitchens"
                className="bg-white text-[#B92F34] hover:bg-gray-100 font-semibold py-4 px-8 rounded-lg transition-all duration-300 transform hover:scale-105"
              >
                View Our Kitchens
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
