"use client";
import Navbar from "@/components/Navbar";
import React from "react";
import { useRef, useState } from "react";
import Footer from "@/components/footer";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";

export default function page() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    message: "",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const form = useRef();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Add your form submission logic here
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e) => { };

  const removeImage = (index) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    setPreviewImages(updatedFiles.map((file) => URL.createObjectURL(file)));
  };

  return (
    <div>
      <Navbar bar={true} />
      {/* Contact Section */}
      <div className="pt-32 pb-16 bg-linear-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-center space-y-4 sm:space-y-6 mb-12 sm:mb-16"
            data-aos="fade-up"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-800">
              Get Your <span className="text-[#B92F34]">Free Quote</span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto px-4">
              Ready to transform your space? Contact us today for a personalized
              consultation and free quote.
            </p>
          </div>

          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row lg:items-start gap-6 sm:gap-8 lg:gap-12">
              {/* Map and Contact Info Section */}
              <div className="w-full lg:w-1/2 flex flex-col">
                <div className="w-full h-64 sm:h-80 md:h-96 lg:h-[30rem] overflow-hidden rounded-lg shadow-md">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d6547.987404224774!2d138.6569056755532!3d-34.856385572864795!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6ab0b593fc6cf361%3A0x3adbca0303e8b578!2sIkonic%20Kitchens%20%26%20Cabinets!5e0!3m2!1sen!2sau!4v1757402982480!5m2!1sen!2sau"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                  ></iframe>
                </div>

                <div className="mt-6 space-y-4 text-sm sm:text-base text-gray-700">
                  <a
                    href="https://maps.app.goo.gl/StVQypTKNziXq5Uz8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 hover:text-gray-700 transition-colors"
                    aria-label="View our location on Google Maps"
                  >
                    <div className="shrink-0">
                      <MapPin size={20} />
                    </div>
                    <p>
                      5 Dundee Avenue, Holden Hill, South Australia, 5088,
                      Australia
                    </p>
                  </a>

                  <a
                    href="mailto:info@ikonickitchens.com.au"
                    className="flex items-center gap-3 hover:text-gray-700 transition-colors"
                    aria-label="Send us an email"
                  >
                    <div className="shrink-0">
                      <Mail size={20} />
                    </div>
                    <p className="break-words">info@ikonickitchens.com.au</p>
                  </a>

                  <div
                    className="flex items-center gap-3 hover:text-gray-700 transition-colors"
                    aria-label="Call our office"
                  >
                    <div className="shrink-0">
                      <Phone size={20} />
                    </div>
                    <div className="flex flex-col">
                      <a href="tel:0881653886">(08) 8165 3886</a>
                      <a href="tel:0426246791">0426 246 791</a>
                      <a href="tel:0433693005">0433 693 005</a>
                      <a href="tel:0450223904">0450 223 904</a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      <Clock size={20} />
                    </div>
                    <p>Monday - Friday, 9 am - 5 pm</p>
                  </div>
                </div>
              </div>

              {/* Contact Form Section */}
              <div className="w-full lg:w-1/2 mt-6 sm:mt-8 lg:mt-0">
                <div className="bg-white py-6 sm:py-8 px-4 sm:px-6 lg:px-8 rounded-2xl shadow-xl">
                  <form
                    ref={form}
                    onSubmit={handleSubmit}
                    className="space-y-5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="relative">
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          placeholder=" "
                          required
                          className="peer block w-full px-4 py-3 text-sm text-gray-900 bg-white border-2 border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-[#B92F34] transition-colors duration-200"
                        />
                        <label className="absolute mx-2 rounded text-sm text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-[#B92F34] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3">
                          First Name *
                        </label>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          placeholder=" "
                          required
                          className="peer block w-full px-4 py-3 text-sm text-gray-900 bg-white border-2 border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-[#B92F34] transition-colors duration-200"
                        />
                        <label className="absolute mx-2 rounded text-sm text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-[#B92F34] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3">
                          Last Name *
                        </label>
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="tel"
                        name="phoneNumber"
                        value={formData.phoneNumber}
                        onChange={handleChange}
                        placeholder=" "
                        required
                        className="peer block w-full px-4 py-3 text-sm text-gray-900 bg-white border-2 border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-[#B92F34] transition-colors duration-200"
                      />
                      <label className="absolute mx-2 rounded text-sm text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-[#B92F34] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3">
                        Phone Number *
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder=" "
                        required
                        className="peer block w-full px-4 py-3 text-sm text-gray-900 bg-white border-2 border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-[#B92F34] transition-colors duration-200"
                      />
                      <label className="absolute mx-2 rounded text-sm text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-[#B92F34] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3">
                        Email *
                      </label>
                    </div>

                    <div className="relative">
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        placeholder=" "
                        rows="4"
                        required
                        className="peer block w-full px-4 py-3 text-sm text-gray-900 bg-white border-2 border-gray-200 rounded-lg appearance-none focus:outline-none focus:ring-0 focus:border-[#B92F34] transition-colors duration-200 resize-none"
                      />
                      <label className="absolute mx-2 rounded text-sm text-gray-500 duration-300 transform -translate-y-3 scale-75 top-2 z-10 origin-[0] bg-white px-2 peer-focus:px-2 peer-focus:text-[#B92F34] peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-0 peer-focus:scale-75 peer-focus:-translate-y-3">
                        Message *
                      </label>
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Attach Photos (optional)
                      </label>
                      <div className="cursor-pointer hover:border-[#B92F34] mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-gray-200 border-dashed rounded-lg transition-colors duration-200">
                        <div className="space-y-1 text-center">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            stroke="currentColor"
                            fill="none"
                            viewBox="0 0 48 48"
                            aria-hidden="true"
                          >
                            <path
                              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                              strokeWidth={2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div className="flex text-sm text-gray-600">
                            <label
                              htmlFor="file-upload"
                              className="relative cursor-pointer bg-white rounded-md font-medium text-gray-700 hover:text-gray-800 focus-within:outline-none"
                            >
                              <span>Upload images</span>
                              <input
                                id="file-upload"
                                name="file-upload"
                                type="file"
                                className="sr-only"
                                multiple
                                accept="image/*"
                                onChange={handleFileChange}
                              />
                            </label>
                            <p className="pl-1">or drag and drop</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            Images up to 5MB total (max 5MB per file)
                          </p>
                        </div>
                      </div>

                      {/* Show current upload size */}
                      {selectedFiles.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          {selectedFiles.length} file(s) selected •{" "}
                          {(
                            selectedFiles.reduce(
                              (total, file) => total + file.size,
                              0
                            ) /
                            (1024 * 1024)
                          ).toFixed(1)}
                          MB of 5MB used
                        </div>
                      )}

                      {/* Preview selected images */}
                      {previewImages.length > 0 && (
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {previewImages.map((preview, index) => (
                            <div key={index} className="relative">
                              <Image
                                loading="lazy"
                                width={100}
                                height={100}
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="h-24 w-full object-cover rounded-md"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="cursor-pointer hover:bg-red-700 absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                                aria-label="Remove image"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isUploading}
                      className="w-full bg-[#B92F34] hover:bg-[#A0252A] text-white py-4 rounded-lg transition-all duration-300 font-semibold cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform hover:scale-105 shadow-lg"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Submitting...
                        </>
                      ) : (
                        "Get Free Quote"
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
