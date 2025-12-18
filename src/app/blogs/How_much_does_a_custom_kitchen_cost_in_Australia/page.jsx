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
              How Much Does a Custom Kitchen Cost in Australia?
            </h1>
            <p className="text-gray-300 text-lg mb-4">
              A comprehensive guide to understanding custom kitchen pricing and what affects the cost
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
                ~5 min read
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
                When planning a kitchen renovation, one of the first questions homeowners ask is:{" "}
                <strong>How much does a custom kitchen actually cost in Australia?</strong>
              </p>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                The answer depends on several factors, including design, materials, size, and level of customisation. Unlike flat-pack kitchens, custom kitchens are built specifically for your space, which means pricing varies based on your choices and requirements.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                This guide breaks down the real costs of a custom kitchen, what affects pricing, and how to decide what's right for your home.
              </p>
            </section>

            {/* Average Cost Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Average Cost of a Custom Kitchen in Australia
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                In Australia, a custom kitchen typically costs between <strong>$20,000 and $45,000+</strong>.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                Here's a general breakdown:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 text-lg">
                <li><strong>Small custom kitchens:</strong> $20,000 – $25,000</li>
                <li><strong>Mid-range custom kitchens:</strong> $25,000 – $35,000</li>
                <li><strong>High-end custom kitchens:</strong> $35,000 – $50,000+</li>
              </ul>
              <p className="text-gray-700 text-lg leading-relaxed">
                These prices usually include custom cabinetry, design, manufacturing, and installation. Appliances, stone benchtops, plumbing, electrical work, and splashbacks may be additional depending on your project scope.
              </p>
            </section>

            {/* Factors Affecting Cost Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                What Factors Affect the Cost of a Custom Kitchen?
              </h2>

              {/* Factor 1 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  1. Kitchen Size and Layout
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed">
                  The size of your kitchen plays a major role in pricing. Larger kitchens require more cabinetry, materials, and labour. Complex layouts such as U-shaped kitchens, large islands, or butler's pantries also increase costs compared to simple galley or L-shaped designs.
                </p>
              </div>

              {/* Factor 2 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  2. Cabinetry Materials
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  Cabinet materials significantly impact both cost and durability.
                </p>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  Common options include:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                  <li><strong>Moisture-resistant MDF</strong> – cost-effective and popular for painted finishes</li>
                  <li><strong>Plywood cabinetry</strong> – stronger and more durable, slightly higher cost</li>
                  <li><strong>Timber veneer</strong> – offers a natural timber look at a mid-range price</li>
                  <li><strong>Solid timber</strong> – premium option with higher cost and long lifespan</li>
                </ul>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Higher-quality materials cost more upfront but usually last longer and perform better over time.
                </p>
              </div>

              {/* Factor 3 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  3. Finishes and Colours
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  The finish you choose affects pricing and overall appearance.
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                  <li><strong>Laminate finishes</strong> are durable and budget-friendly</li>
                  <li><strong>Painted finishes</strong> provide a premium, smooth look</li>
                  <li><strong>Timber finishes</strong> add warmth and natural character</li>
                </ul>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Custom colours, matte finishes, and specialty coatings may increase costs slightly.
                </p>
              </div>

              {/* Factor 4 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  4. Storage and Custom Features
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  One of the biggest advantages of a custom kitchen is tailored storage.
                </p>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  Popular features include:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                  <li>Soft-close drawers and hinges</li>
                  <li>Pull-out pantries</li>
                  <li>Corner storage solutions</li>
                  <li>Integrated bins</li>
                  <li>Custom drawer inserts</li>
                </ul>
                <p className="text-gray-700 text-lg leading-relaxed">
                  While these features add to the cost, they significantly improve functionality and everyday usability.
                </p>
              </div>

              {/* Factor 5 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  5. Benchtops and Hardware
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  Although cabinetry is the core cost, benchtops and hardware also affect your final budget.
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                  <li><strong>Laminate benchtops</strong> are affordable</li>
                  <li><strong>Engineered stone</strong> is the most popular mid-range option</li>
                  <li><strong>Natural stone</strong> is premium and more expensive</li>
                </ul>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Quality hardware such as soft-close runners and premium handles adds durability and long-term value.
                </p>
              </div>
            </section>

            {/* Custom vs Flat-Pack Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Custom Kitchen vs Flat-Pack Kitchen Costs
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-6">
                Flat-pack kitchens may seem cheaper initially, often starting around $10,000–$15,000, but they come with limitations.
              </p>
              
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Flat-pack kitchens:</h3>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>Standard sizes</li>
                    <li>Limited design flexibility</li>
                    <li>Shorter lifespan</li>
                    <li>Less efficient use of space</li>
                  </ul>
                </div>
                <div className="bg-blue-50 p-6 rounded-lg">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Custom kitchens:</h3>
                  <ul className="list-disc pl-6 space-y-2 text-gray-700">
                    <li>Designed to fit your exact space</li>
                    <li>Higher build quality</li>
                    <li>Better storage solutions</li>
                    <li>Longer lifespan and resale value</li>
                  </ul>
                </div>
              </div>
              
              <p className="text-gray-700 text-lg leading-relaxed">
                Over time, custom kitchens often provide better value due to durability and reduced need for repairs or replacements.
              </p>
            </section>

            {/* Investment Worth Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Is a Custom Kitchen Worth the Investment?
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                For many homeowners, <strong>yes</strong>. A custom kitchen offers:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 text-lg">
                <li>Better use of space</li>
                <li>Higher quality materials and workmanship</li>
                <li>Improved daily functionality</li>
                <li>Increased property value</li>
              </ul>
              <p className="text-gray-700 text-lg leading-relaxed">
                Kitchens are one of the most important areas for home buyers, and a well-designed custom kitchen can make a strong impression when selling.
              </p>
            </section>

            {/* Budgeting Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                How to Budget for a Custom Kitchen
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                To avoid surprises, consider:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 text-lg">
                <li>Setting a clear budget range early</li>
                <li>Prioritising must-have features</li>
                <li>Allowing a contingency of 10–15%</li>
                <li>Choosing materials that balance cost and durability</li>
              </ul>
              <p className="text-gray-700 text-lg leading-relaxed">
                Working with an experienced cabinet maker helps ensure your budget is used efficiently without compromising quality.
              </p>
            </section>

            {/* Final Thoughts Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Final Thoughts
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                The cost of a custom kitchen in Australia depends on your choices, but it is an investment in quality, functionality, and long-term value. While the upfront cost may be higher than flat-pack options, the benefits of custom cabinetry often outweigh the difference.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                If you're planning a kitchen renovation, consulting a professional cabinet maker early in the process will help you understand costs, options, and design possibilities tailored to your home.
              </p>
            </section>
          </div>
        </article>

        {/* Call to Action Section */}
        <div className="bg-linear-to-r from-[#B92F34] to-[#A0252A] py-16 px-4">
          <div className="container mx-auto max-w-4xl text-center text-white">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Start Your Custom Kitchen Project?
            </h2>
            <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
              Get expert advice and a free quote for your custom kitchen renovation. Our experienced team will help you understand costs, explore design options, and create a kitchen that perfectly fits your space and budget.
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
