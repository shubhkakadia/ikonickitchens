const numberedImages = (directory, count, extension = "webp") =>
  Array.from(
    { length: count },
    (_, index) =>
      `${directory}${String(index + 1).padStart(2, "0")}.${extension}`,
  );

const galleryImages = (directory, count) =>
  Array.from({ length: count }, (_, index) => `${directory}/${index + 1}.webp`);

export const contactDetails = {
  phone: "(08) 8165 3886",
  phoneHref: "tel:0881653886",
  mobiles: ["0426 246 791", "0452 669 964", "0450 223 904"],
  email: "info@ikonickitchens.com.au",
  address: "5 Dundee Avenue, Holden Hill, South Australia 5088, Australia",
  mapsHref:
    "https://www.google.com/maps/place/Ikonic+Kitchens+%26+Cabinets/@-34.8563812,138.6569057,17z/data=!3m1!4b1!4m6!3m5!1s0x6ab0b593fc6cf361:0x3adbca0303e8b578!8m2!3d-34.8563856!4d138.6594806!16s%2Fg%2F11lcpwf4kf?entry=ttu&g_ep=EgoyMDI2MDkwMS4wIKXMDSoASAFQAw%3D%3D",
  hours: "Monday–Friday, 9am–5pm",
};

export const services = [
  {
    number: "01",
    name: "Custom kitchens",
    blurb:
      "Cabinetry designed around the room, the way you cook and the storage you need.",
    body: "Every kitchen is designed to suit its space and functional requirements, then manufactured and installed as a complete custom solution.",
    detail: "Custom layouts · cabinetry · professional installation",
  },
  {
    number: "02",
    name: "Built-in wardrobes",
    blurb: "Fitted wardrobes and storage systems made for the available space.",
    body: "From compact built-ins to walk-in storage, each wardrobe is configured around the room and the way its storage will be used.",
    detail: "Built-ins · walk-ins · custom internals",
  },
  {
    number: "03",
    name: "Bathroom vanities",
    blurb: "Custom vanities and bathroom cabinetry with considered storage.",
    body: "Bathroom cabinetry is planned around plumbing, circulation and everyday use, with proportions and finishes selected for the room.",
    detail: "Vanities · shaving cabinets · fitted storage",
  },
  {
    number: "04",
    name: "Laundries",
    blurb:
      "Practical cabinetry that gives working rooms a clear place for everything.",
    body: "We create laundry layouts that make better use of narrow or unusual rooms while integrating appliances, storage and bench space.",
    detail: "Appliance housings · overhead storage · work surfaces",
  },
];

export const materials = [
  {
    name: "Polytec",
    note: "A broad collection of decorative surfaces for cabinetry and interiors.",
  },
  {
    name: "Laminex",
    note: "Durable decorative finishes in colours, woodgrains and tactile surfaces.",
  },
  {
    name: "Australian Timbers",
    note: "Natural timber options for warmth, detail and individual character.",
  },
  {
    name: "Acrilam",
    note: "Contemporary panel finishes for clean, refined cabinetry.",
  },
];

export const processSteps = [
  {
    number: "1",
    name: "Enquiry",
    when: "Tell us about the room",
    body: "Share the type of cabinetry you need, the location and any plans, measurements or ideas you already have.",
  },
  {
    number: "2",
    name: "Consultation",
    when: "Understand the space",
    body: "We discuss the room, how it needs to work and the design direction before the project is developed further.",
  },
  {
    number: "3",
    name: "Design",
    when: "Resolve the details",
    body: "The layout, storage, materials and finishes are refined into a custom solution for your space.",
  },
  {
    number: "4",
    name: "Manufacture",
    when: "Build the cabinetry",
    body: "Once the design is approved, the cabinetry is manufactured to the dimensions and requirements of the project.",
  },
  {
    number: "5",
    name: "Installation",
    when: "Fit the room",
    body: "The finished cabinetry is delivered and professionally installed, with the fit and function checked on site.",
  },
  {
    number: "6",
    name: "Handover",
    when: "Complete the project",
    body: "The completed work is reviewed with you and any final adjustments are made before handover.",
  },
];

export const testimonials = [
  {
    quote:
      "We couldn't be happier with our new kitchen. The workmanship is exceptional, the finishes are flawless, and the entire process was smooth from start to finish.",
    name: "Michael Turner",
    role: "Kitchen client",
  },
  {
    quote:
      "Ikonic Kitchens & Cabinets delivered exactly what they promised. High-quality cabinetry, clear communication, and attention to detail that really stands out.",
    name: "Sarah Collins",
    role: "Cabinetry client",
  },
  {
    quote:
      "From the initial consultation to the final installation, the team was professional and easy to work with. Our kitchen looks modern, functional, and beautifully crafted.",
    name: "Daniel Wright",
    role: "Kitchen client",
  },
];

export const faqs = [
  {
    question: "Do you offer custom kitchen and cabinetry designs?",
    answer:
      "Yes, we specialise in fully custom kitchen and cabinetry solutions. Every project is designed to suit your space, style, and functional requirements.",
  },
  {
    question: "What types of cabinetry do you make?",
    answer:
      "We design and manufacture kitchen cabinets, wardrobes, laundries, bathroom vanities, storage units, and other custom cabinetry for residential and commercial spaces.",
  },
  {
    question: "Do you handle the entire project from design to installation?",
    answer:
      "Yes, we manage the complete process including design consultation, manufacturing, and professional installation to ensure a seamless experience.",
  },
  {
    question: "How long does a typical kitchen or cabinetry project take?",
    answer:
      "Timelines vary depending on project size and complexity. We confirm the expected programme once the design and scope are understood.",
  },
  {
    question: "Do you work with builders or designers?",
    answer:
      "Yes, we regularly work with builders, renovators, interior designers, and architects on residential and commercial projects.",
  },
  {
    question: "Can you customise cabinetry for small or unusual spaces?",
    answer:
      "Absolutely. Custom cabinetry is ideal for maximising storage and functionality in small, narrow, or uniquely shaped spaces.",
  },
];

export const heroSlides = [
  {
    image: "/18 William Avenue/image05.jpg",
    label: "18 William Avenue",
    place: "Henley Beach · completed joinery",
  },
  {
    image: "/Gallery/1.png",
    label: "Custom kitchens",
    place: "Designed, manufactured and installed",
  },
  {
    image: "/Gallery/Wardrobe/1.webp",
    label: "Built-in wardrobes",
    place: "Storage made for the room",
  },
  {
    image: "/expertise.webp",
    label: "Made with care",
    place: "Cabinetry craftsmanship",
  },
];

export const collections = [
  {
    slug: "william-avenue-henley-beach",
    title: "18 William Avenue",
    category: "Kitchens",
    type: "Completed project",
    location: "Henley Beach, South Australia",
    href: "/portfolio/william-avenue-henley-beach",
    cover: "/18 William Avenue/image05.jpg",
    images: numberedImages("/18 William Avenue/image", 16, "jpg"),
    description:
      "A completed residential project featuring custom kitchen and fitted joinery throughout the home.",
    metadata: [
      { label: "Location", value: "Henley Beach, South Australia" },
      { label: "Collection", value: "Custom joinery" },
    ],
  },
  {
    slug: "kitchens",
    title: "Kitchen collection",
    category: "Kitchens",
    type: "Kitchens",
    location: "South Australia",
    href: "/kitchens",
    cover: "/Gallery/Kitchen/1.webp",
    images: galleryImages("/Gallery/Kitchen", 18),
    description:
      "Custom kitchen designs created to suit each space, style and functional requirement.",
    metadata: [{ label: "Collection", value: "Custom kitchens" }],
  },
  {
    slug: "wardrobes",
    title: "Wardrobe collection",
    category: "Wardrobes",
    type: "Wardrobes",
    location: "South Australia",
    href: "/wardrobes",
    cover: "/Gallery/Wardrobe/1.webp",
    images: galleryImages("/Gallery/Wardrobe", 3),
    description:
      "Built-in and walk-in wardrobe solutions designed to make better use of the available space.",
    metadata: [{ label: "Collection", value: "Custom wardrobes" }],
  },
  {
    slug: "bathrooms",
    title: "Bathroom collection",
    category: "Bathrooms",
    type: "Bathrooms",
    location: "South Australia",
    href: "/bathroom",
    cover: "/Gallery/Bathroom/1.webp",
    images: galleryImages("/Gallery/Bathroom", 18),
    description:
      "Bathroom vanities and fitted storage designed around the room and its everyday use.",
    metadata: [{ label: "Collection", value: "Bathroom cabinetry" }],
  },
  {
    slug: "laundry",
    title: "Laundry collection",
    category: "Laundry",
    type: "Laundries",
    location: "South Australia",
    href: "/laundry",
    cover: "/Gallery/Laundry/1.webp",
    images: galleryImages("/Gallery/Laundry", 3),
    description:
      "Purpose-built laundry cabinetry that brings storage and working space into one considered layout.",
    metadata: [{ label: "Collection", value: "Custom laundries" }],
  },
];

export const collectionBySlug = Object.fromEntries(
  collections.map((collection) => [collection.slug, collection]),
);

export const workshopImages = [
  "/expertise.webp",
  "/mission.webp",
  "/Gallery/Kitchen/5.webp",
  "/product.webp",
];

export const blogPosts = [
  {
    slug: "How_much_does_a_custom_kitchen_cost_in_Australia",
    title: "How Much Does a Custom Kitchen Cost in Australia?",
    subtitle:
      "A guide to understanding custom kitchen pricing and the choices that affect it.",
    date: "18 Dec 2025",
    readTime: "5 min read",
  },
  {
    slug: "What_is_the_difference_between_custom_cabinets_and_modular_cabinets",
    title: "Custom Cabinets and Modular Cabinets: What Is the Difference?",
    subtitle:
      "The key differences to consider when planning cabinetry for a renovation.",
    date: "18 Dec 2025",
    readTime: "6 min read",
  },
  {
    slug: "How_long_does_it_take_to_build_and_install_a_custom_kitchen",
    title: "How Long Does a Custom Kitchen Take?",
    subtitle:
      "What to expect while a custom kitchen is designed, built and installed.",
    date: "18 Dec 2025",
    readTime: "5 min read",
  },
];
