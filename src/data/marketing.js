const numberedImages = (directory, count, extension = "webp") =>
  Array.from(
    { length: count },
    (_, index) =>
      `${directory}${String(index + 1).padStart(2, "0")}.${extension}`,
  );

const galleryImages = (directory, count) =>
  Array.from({ length: count }, (_, index) => `${directory}/${index + 1}.webp`);

const range = (start, end) =>
  Array.from({ length: end - start + 1 }, (_, index) => start + index);

const standardProjectFiles = (numbers, extras = []) => [
  "image.jpg",
  ...numbers.map((number) => `image (${number}).jpg`),
  ...extras,
];

const projectCollection = ({ folder, slug, title, location, cover, files }) => {
  const orderedFiles = [cover, ...files.filter((file) => file !== cover)];

  return {
    slug,
    title,
    category: "Projects",
    type: "Completed project",
    location,
    href: `/portfolio/${slug}`,
    cover: `/${folder}/${cover}`,
    images: orderedFiles.map((file) => `/${folder}/${file}`),
    description: `A completed custom cabinetry project in ${location}.`,
    metadata: [
      { label: "Location", value: location },
      { label: "Collection", value: "Custom cabinetry" },
    ],
  };
};

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
    image: "/carousel-upscaled/388-grand-junction-road.webp",
    label: "388 Grand Junction Road",
    place: "Enfield · completed project",
  },
  {
    image: "/carousel-upscaled/42a-stanley-street.webp",
    label: "42A Stanley Street",
    place: "Glengowrie · completed project",
  },
  {
    image: "/carousel-upscaled/6-salisbury-terrace.webp",
    label: "6 Salisbury Terrace",
    place: "Camden Park · completed project",
  },
  {
    image: "/carousel-upscaled/16-arthur-street.webp",
    label: "16 Arthur Street",
    place: "Richmond · completed project",
  },
];

export const projects = [
  projectCollection({
    folder: "1 Bella Street Hopevally",
    slug: "1-bella-street-hope-valley",
    title: "1 Bella Street",
    location: "Hope Valley, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 10)),
  }),
  projectCollection({
    folder: "1 Tensing Ave Morphettville",
    slug: "1-tensing-avenue-morphettville",
    title: "1 Tensing Avenue",
    location: "Morphettville, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles([1, 2, 3, 4, 13]),
  }),
  projectCollection({
    folder: "11 Karri Drive Dernancourt",
    slug: "11-karri-drive-dernancourt",
    title: "11 Karri Drive",
    location: "Dernancourt, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 11)),
  }),
  projectCollection({
    folder: "116 Walkleys Road valley View",
    slug: "116-walkleys-road-valley-view",
    title: "116 Walkleys Road",
    location: "Valley View, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 7), ["image.png"]),
  }),
  projectCollection({
    folder: "16 Arthur Street Richmond",
    slug: "16-arthur-street-richmond",
    title: "16 Arthur Street",
    location: "Richmond, South Australia",
    cover: "006_Open2view_ID991980-16_Arthur_Street.webp",
    files: [
      "001_Open2view_ID991980-16_Arthur_Street.webp",
      "004_Open2view_ID991980-16_Arthur_Street.webp",
      "006_Open2view_ID991980-16_Arthur_Street.webp",
      "007_Open2view_ID991980-16_Arthur_Street.webp",
      "008_Open2view_ID991980-16_Arthur_Street.webp",
      "009_Open2view_ID991980-16_Arthur_Street.webp",
      "016_Open2view_ID991980-16_Arthur_Street.webp",
      "017_Open2view_ID991980-16_Arthur_Street.webp",
      "019_Open2view_ID991980-16_Arthur_Street.webp",
      "020_Open2view_ID991980-16_Arthur_Street.webp",
      "023_Open2view_ID991980-16_Arthur_Street.webp",
      "024_Open2view_ID991980-16_Arthur_Street.webp",
      "027_Open2view_ID991980-16_Arthur_Street.webp",
      "028_Open2view_ID991980-16_Arthur_Street.webp",
    ],
  }),
  projectCollection({
    slug: "william-avenue-henley-beach",
    folder: "18 William Avenue",
    title: "18 William Avenue",
    location: "Henley Beach, South Australia",
    cover: "image05.jpg",
    files: range(1, 16).map(
      (number) => `image${String(number).padStart(2, "0")}.jpg`,
    ),
  }),
  projectCollection({
    folder: "33 Dwyer Road Oaklands Park",
    slug: "33-dwyer-road-oaklands-park",
    title: "33 Dwyer Road",
    location: "Oaklands Park, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 9)),
  }),
  projectCollection({
    folder: "388 Grand junction Road Enfield",
    slug: "388-grand-junction-road-enfield",
    title: "388 Grand Junction Road",
    location: "Enfield, South Australia",
    cover: "image10.jpg",
    files: [
      "main.jpg",
      "image3.jpg",
      "image6.jpg",
      "image9.jpg",
      "image10.jpg",
      "image11.jpg",
      "image13.jpg",
      "image14.jpg",
    ],
  }),
  projectCollection({
    folder: "3A Parkmore Avenue Stuart",
    slug: "3a-parkmore-avenue-sturt",
    title: "3A Parkmore Avenue",
    location: "Sturt, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 11)),
  }),
  projectCollection({
    folder: "3B everest Street Henley Beach",
    slug: "3b-everest-street-henley-beach",
    title: "3B Everest Street",
    location: "Henley Beach, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 10)),
  }),
  projectCollection({
    folder: "40 La Parouse Ave Flinders Park",
    slug: "40-la-perouse-avenue-flinders-park",
    title: "40 La Perouse Avenue",
    location: "Flinders Park, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(
      [1, 9],
      ["download.png", "download (1).png", "download (2).png"],
    ),
  }),
  projectCollection({
    folder: "40 Shelley Ave Fulham Gardens",
    slug: "40-shelley-avenue-fulham-gardens",
    title: "40 Shelley Avenue",
    location: "Fulham Gardens, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 9)),
  }),
  projectCollection({
    folder: "42 Caroline Drive Fulham Gardens",
    slug: "42-caroline-drive-fulham-gardens",
    title: "42 Caroline Drive",
    location: "Fulham Gardens, South Australia",
    cover: "0ab9-H3523400-205193286__1781056359-47689-017A0861.webp",
    files: [
      "0ab9-H3523400-205193286__1781056359-47689-017A0861.webp",
      "0fde-H3523400-205193338__1781056368-59109-017A0881.webp",
      "5fdf-H3523400-205193291__1781056361-59324-017A0866.webp",
      "9601-H3523400-205193271__1781056356-47678-017A0851.webp",
      "9684-H3523400-205193357__1781056378-240587-017A0901.webp",
      "c223-H3523400-205193415__1781056409-59240-017A0966.webp",
      "ebb1-H3523400-209055144__1783572156-76011-ChatGPTImageJul92026021120PM.webp",
    ],
  }),
  projectCollection({
    folder: "42A Stanley Street Glengowrie",
    slug: "42a-stanley-street-glengowrie",
    title: "42A Stanley Street",
    location: "Glengowrie, South Australia",
    cover: "image (5).jpg",
    files: standardProjectFiles(range(1, 14), ["image.png"]),
  }),
  projectCollection({
    folder: "48 Wheaton Road Plympton",
    slug: "48-wheaton-road-plympton",
    title: "48 Wheaton Road",
    location: "Plympton, South Australia",
    cover: "image (2).jpg",
    files: standardProjectFiles([...range(1, 7), 11]),
  }),
  projectCollection({
    folder: "57 Arthur Street Plympton Park",
    slug: "57-arthur-street-plympton-park",
    title: "57 Arthur Street",
    location: "Plympton Park, South Australia",
    cover: "image11.jpg",
    files: [
      "main.jpg",
      "image4.jpg",
      "image5.jpg",
      "image6.jpg",
      "image7.jpg",
      "image8.jpg",
      "image9.jpg",
      "image11.jpg",
      "image13.jpg",
      "image16.jpg",
      "image20.jpg",
      "image21.jpg",
      "image25.jpg",
    ],
  }),
  projectCollection({
    folder: "6 Salisbury Tce Camben Park",
    slug: "6-salisbury-terrace-camden-park",
    title: "6 Salisbury Terrace",
    location: "Camden Park, South Australia",
    cover: "image (1).jpg",
    files: standardProjectFiles([1, 2, 3, 4, 10]),
  }),
  projectCollection({
    folder: "77 McArthur Ave Plympton",
    slug: "77-mcarthur-avenue-plympton",
    title: "77 McArthur Avenue",
    location: "Plympton, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 8)),
  }),
  projectCollection({
    folder: "8 Scott Street Firle",
    slug: "8-scott-street-firle",
    title: "8 Scott Street",
    location: "Firle, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 12)),
  }),
  projectCollection({
    folder: "9 Frost Street",
    slug: "9-frost-street",
    title: "9 Frost Street",
    location: "South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 4)),
  }),
  projectCollection({
    folder: "9A Chilworth Avenu Enfield",
    slug: "9a-chilworth-avenue-enfield",
    title: "9A Chilworth Avenue",
    location: "Enfield, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles([...range(1, 5), 11]),
  }),
  projectCollection({
    folder: "9B Chilworth Avenue Enfield",
    slug: "9b-chilworth-avenue-enfield",
    title: "9B Chilworth Avenue",
    location: "Enfield, South Australia",
    cover: "image.jpg",
    files: standardProjectFiles(range(1, 7)),
  }),
];

export const collections = [
  ...projects,
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
