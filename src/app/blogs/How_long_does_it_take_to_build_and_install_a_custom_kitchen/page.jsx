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
              How Long Does It Take to Build and Install a Custom Kitchen?
            </h1>
            <p className="text-gray-300 text-lg mb-4">
              Understanding the typical timeline for designing, building, and installing a custom kitchen
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
                One of the most common questions homeowners ask when planning a kitchen renovation is: <strong>How long will it take?</strong>
              </p>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                A custom kitchen is a major investment, and understanding the timeline helps you plan around daily life, budgets, and expectations.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                While every project is different, this guide explains the typical timeline for designing, building, and installing a custom kitchen, and what factors can affect the schedule.
              </p>
            </section>

            {/* Average Timeline Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Average Timeline for a Custom Kitchen
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                In Australia, a custom kitchen typically takes <strong>6 to 10 weeks</strong> from final design approval to installation completion.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                This timeline includes design finalisation, manufacturing, and installation, but does not usually include demolition, plumbing, electrical work, or benchtop fabrication unless managed as part of a full renovation.
              </p>
            </section>

            {/* Stage-by-Stage Breakdown Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Stage-by-Stage Breakdown of the Custom Kitchen Timeline
              </h2>

              {/* Stage 1 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  1. Initial Consultation and Design (1–3 Weeks)
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  The process begins with an initial consultation where measurements are taken and your requirements are discussed. This includes:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                  <li>Kitchen layout planning</li>
                  <li>Cabinet design and configuration</li>
                  <li>Material and finish selection</li>
                  <li>Storage and functionality planning</li>
                </ul>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Revisions and approvals can take a little time, especially if you are comparing options or waiting on decisions. A clear brief and timely approvals help keep this stage moving efficiently.
                </p>
              </div>

              {/* Stage 2 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  2. Final Design Approval and Ordering (1 Week)
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  Once the design is finalised and approved, materials and hardware are ordered. This stage is critical, as manufacturing does not begin until all details are confirmed.
                </p>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Any changes after this point can result in delays, so it's important to finalise all decisions before sign-off.
                </p>
              </div>

              {/* Stage 3 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  3. Cabinet Manufacturing (3–5 Weeks)
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  After approval, your custom cabinets are manufactured in the workshop. This stage includes:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                  <li>Cutting and assembling cabinetry</li>
                  <li>Applying finishes such as laminate, paint, or veneer</li>
                  <li>Installing hardware like hinges and drawer runners</li>
                  <li>Quality checks before delivery</li>
                </ul>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Manufacturing time can vary depending on the complexity of the design, material availability, and overall workload.
                </p>
              </div>

              {/* Stage 4 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  4. Delivery and Installation (2–5 Days)
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  Once the cabinets are ready, they are delivered to site and installed by professional installers. Installation typically includes:
                </p>
                <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700 text-lg">
                  <li>Positioning and securing cabinetry</li>
                  <li>Aligning doors and drawers</li>
                  <li>Ensuring correct fit and finish</li>
                </ul>
                <p className="text-gray-700 text-lg leading-relaxed">
                  For most kitchens, installation takes two to five days, depending on size and layout.
                </p>
              </div>

              {/* Stage 5 */}
              <div className="mb-8">
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  5. Benchtops and Final Touches (Optional)
                </h3>
                <p className="text-gray-700 text-lg leading-relaxed mb-4">
                  If stone or engineered benchtops are included, additional time may be required after cabinet installation. Stone benchtops often take 1–2 weeks for templating, fabrication, and installation.
                </p>
                <p className="text-gray-700 text-lg leading-relaxed">
                  Final touches such as handles, splashbacks, and appliance fitting may follow.
                </p>
              </div>
            </section>

            {/* What Can Cause Delays Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                What Can Cause Delays in a Custom Kitchen Project?
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                Several factors can affect the overall timeline:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 text-lg">
                <li>Design changes after approval</li>
                <li>Material or hardware availability</li>
                <li>Complex custom features</li>
                <li>Structural or site issues</li>
                <li>Coordination with other trades</li>
              </ul>
              <p className="text-gray-700 text-lg leading-relaxed">
                Working with an experienced cabinet maker helps minimise delays by planning ahead and managing expectations.
              </p>
            </section>

            {/* How to Keep on Schedule Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                How to Keep Your Kitchen Project on Schedule
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                To avoid unnecessary delays:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 text-lg">
                <li>Finalise your design early</li>
                <li>Make material selections promptly</li>
                <li>Allow flexibility for custom features</li>
                <li>Work with a professional cabinet maker</li>
                <li>Plan trades such as plumbing and electrical in advance</li>
              </ul>
              <p className="text-gray-700 text-lg leading-relaxed">
                Clear communication and good planning are key to a smooth project.
              </p>
            </section>

            {/* Is the Wait Worth It Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Is the Wait Worth It?
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                While a custom kitchen takes longer than installing flat-pack cabinetry, the results are worth the wait. Custom kitchens offer:
              </p>
              <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-700 text-lg">
                <li>Better fit and finish</li>
                <li>Higher quality materials</li>
                <li>Improved functionality</li>
                <li>Longer lifespan</li>
              </ul>
              <p className="text-gray-700 text-lg leading-relaxed">
                Rushing a kitchen renovation often leads to compromises. A well-planned custom kitchen delivers better long-term value and daily enjoyment.
              </p>
            </section>

            {/* Final Thoughts Section */}
            <section className="mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-3">
                Final Thoughts
              </h2>
              <p className="text-gray-700 text-lg leading-relaxed mb-4">
                On average, building and installing a custom kitchen takes 6 to 10 weeks, depending on design complexity and materials. While it requires patience, the outcome is a kitchen tailored to your space, lifestyle, and preferences.
              </p>
              <p className="text-gray-700 text-lg leading-relaxed">
                If you're planning a kitchen renovation, understanding the timeline helps set realistic expectations and ensures a smoother experience from start to finish.
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
              Get expert guidance on timelines and planning for your custom kitchen renovation. Our experienced team will help you understand the process, set realistic expectations, and create a kitchen that's worth the wait.
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
