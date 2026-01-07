"use client";

import React, { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Link from "next/link";
import emailjs from "@emailjs/browser";
import Image from "next/image";
import { Facebook, Instagram } from "lucide-react";

const companylogo = "/logo.webp";

export default function Footer() {
  const [email, setEmail] = useState("");

  const handleJoinClick = async () => {
    if (!validateEmail(email)) {
      toast.error("Please enter a valid email address!", {
        position: "top-center",
        autoClose: 3000,
      });
      return;
    }

    // Show loading state
    const toastId = toast.loading("Processing...", {
      position: "top-center",
    });

    const templateParams = {
      from_name: "",
      from_email: email,
      message: "",
      phone_number: "",
    };
    try {
      emailjs
        .send(
          process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID,
          process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID_SUBSCRIBERS,
          templateParams,
          process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
        )
        .then(
          (result) => {
            toast.dismiss(toastId);
            toast.success("Successfully Joined Newsletter!");
            setEmail(""); // Clear the input after successful subscription
          },
          (error) => {
            console.error("Error sending email:", error.text);
          }
        );
      // Success! Clear form and show success message
      toast.dismiss(toastId);
      toast.success("Successfully Joined Newsletter!");
      setEmail(""); // Clear the input after successful subscription
    } catch (error) {
      if (error.message === "ALREADY_SUBSCRIBED") {
        toast.update(toastId, {
          render: "You're already subscribed to our newsletter!",
          type: "info",
          isLoading: false,
          autoClose: 3000,
        });
      } else {
        toast.update(toastId, {
          render: "Failed to join the newsletter. Please try again later.",
          type: "error",
          isLoading: false,
          autoClose: 3000,
        });
      }
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <footer className="bg-gray-800 text-white">
      <ToastContainer />

      {/* Main Footer Content */}
      <div className="container mx-auto px-4 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Company Info & Logo */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <Image
                loading="lazy"
                src={companylogo}
                alt="Ikonic Kitchens"
                width={200}
                height={200}
                className="h-24 w-auto mb-4"
              />
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                Premium kitchen and cabinet solutions for modern homes. We
                specialize in custom kitchen designs, bathroom renovations,
                laundry solutions, and wardrobe systems with exceptional
                craftsmanship.
              </p>
              <div className="flex space-x-4">
                <Link
                  href="https://www.facebook.com/p/Ikonic-Kitchens-Cabinets-61554967671495/"
                  aria-label="Facebook"
                  className="w-10 h-10 bg-[#B92F34] rounded-full flex items-center justify-center hover:bg-white hover:text-[#B92F34] transition-colors duration-300"
                  target="_blank"
                >
                  <Facebook />
                </Link>
                <Link
                  href="https://www.instagram.com/ikonic_kitchens_cabinets/"
                  aria-label="Instagram"
                  className="w-10 h-10 bg-[#B92F34] rounded-full flex items-center justify-center hover:bg-white hover:text-[#B92F34] transition-colors duration-300"
                  target="_blank"
                >
                  <Instagram />
                </Link>
              </div>
            </div>
          </div>

          {/* Services Section */}
          <div className="lg:col-span-1">
            <h3 className="text-xl font-bold text-[#B92F34] mb-4">
              Our Services
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#B92F34] rounded-full"></div>
                <span className="text-gray-300 text-sm">Custom Kitchens</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#B92F34] rounded-full"></div>
                <span className="text-gray-300 text-sm">Home Improvements</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#B92F34] rounded-full"></div>
                <span className="text-gray-300 text-sm">Laundry Solutions</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#B92F34] rounded-full"></div>
                <span className="text-gray-300 text-sm">Wardrobe Systems</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#B92F34] rounded-full"></div>
                <span className="text-gray-300 text-sm">
                  Design Consultation
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#B92F34] rounded-full"></div>
                <span className="text-gray-300 text-sm">
                  Installation & Maintenance
                </span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-1">
            <h3 className="text-xl font-bold text-[#B92F34] mb-4">
              Quick Links
            </h3>
            <div className="space-y-3">
              <Link
                href="/"
                className="block text-gray-300 text-sm hover:text-[#B92F34] transition-colors duration-200"
              >
                Home
              </Link>
              <Link
                href="/kitchens"
                className="block text-gray-300 text-sm hover:text-[#B92F34] transition-colors duration-200"
              >
                Kitchens
              </Link>
              <Link
                href="/bathroom"
                className="block text-gray-300 text-sm hover:text-[#B92F34] transition-colors duration-200"
              >
                Bathroom
              </Link>
              <Link
                href="/laundry"
                className="block text-gray-300 text-sm hover:text-[#B92F34] transition-colors duration-200"
              >
                Laundry
              </Link>
              <Link
                href="/wardrobes"
                className="block text-gray-300 text-sm hover:text-[#B92F34] transition-colors duration-200"
              >
                Wardrobes
              </Link>
              <Link
                href="/inquiries"
                className="block text-gray-300 text-sm hover:text-[#B92F34] transition-colors duration-200"
              >
                Contact Us
              </Link>
            </div>
          </div>

          {/* Newsletter & Contact */}
          <div className="lg:col-span-1">
            <h3 className="text-xl font-bold text-[#B92F34] mb-4">
              Stay Updated
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Get exclusive offers, design inspiration, and updates on our
              latest kitchen and cabinet solutions.
            </p>
            <div className="mb-6">
              <div className="flex items-center bg-white rounded-full border border-gray-300 overflow-hidden">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="grow px-4 py-3 rounded-l-full outline-none text-gray-800 text-sm"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button
                  className="cursor-pointer bg-[#B92F34] text-white px-6 py-3 rounded-r-full hover:bg-white hover:text-[#B92F34] transition-colors duration-200 font-semibold"
                  onClick={handleJoinClick}
                >
                  Subscribe
                </button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2">
              <p className="text-gray-300 text-sm">
                <span className="text-[#B92F34] font-semibold">
                  Service Areas:
                </span>{" "}
                Australia Wide
              </p>
              <p className="text-gray-300 text-sm">
                <span className="text-[#B92F34] font-semibold">
                  Free Quotes:
                </span>{" "}
                Available
              </p>
              <p className="text-gray-300 text-sm">
                <span className="text-[#B92F34] font-semibold">
                  Experience:
                </span>{" "}
                Premium Quality Craftsmanship
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="text-gray-400 text-sm mb-2 md:mb-0 text-center">
            © 2025 Ikonic Kitchens | All Rights Reserved
          </div>
          <div className="text-gray-400 text-sm text-center">
            Developed by{" "}
            <Link
              href="https://shubhkakadia.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#B92F34] hover:text-white transition-colors duration-200"
            >
              Shubh Kakadia
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
