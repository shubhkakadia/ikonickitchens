/**
 * Mock data seeder — fills every part of the app with realistic test data.
 *
 * Unlike seed-demo.mjs (a tiny dataset for screenshots), this covers the whole
 * schema so each admin page has something to show:
 *
 *   config constants, users (master-admin / admin / manager / employee) with
 *   module access + notification settings, employees, clients + contacts,
 *   suppliers + contacts + statements, ~30 inventory items across all five
 *   categories (with supplier pricing), projects, lots at every point in the
 *   workflow, stages + assignees, lot tabs, material selections (with
 *   versions, areas and items), materials-to-order, purchase orders in every
 *   status, stock transactions (ADDED / USED / WASTED) and reservations,
 *   clock punches (approved / pending / rejected / manual / NFC), NFC tags,
 *   meetings, todos and an audit log.
 *
 * Usage:
 *   node scripts/seed-mock.mjs               # remove old mock data, then seed fresh
 *   node scripts/seed-mock.mjs --clean-only  # remove mock data and stop
 *   node scripts/seed-mock.mjs --force       # allow a non-local database host
 *
 * Re-running is safe: it wipes and recreates only the rows it owns, which also
 * re-anchors every date to "today". Ownership is by naming convention:
 *   usernames "mock.*", employee ids "MOCK-*", client slugs "MK**" (projects
 *   "ikc-mk**-*"), purchase orders "MOCK-PO-*", and ids that start "mock-"
 *   (items, MTOs, transactions, meetings, todos, logs, config, NFC tags).
 *
 * Nothing is uploaded to disk, so lot tabs / material selections / invoices
 * have no attached files.
 */

import "dotenv/config";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

import bcrypt from "bcrypt";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../generated/prisma/index.js");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const TZ = "Australia/Adelaide";
const PASSWORD = "Mock@1234";
const GST_RATE = 0.1;

const args = new Set(process.argv.slice(2));
const cleanOnly = args.has("--clean-only");
const force = args.has("--force");

// Seeding a shared or production database by accident would be painful, so a
// non-local host has to be opted into.
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];
if (!force && !LOCAL_HOSTS.includes(process.env.DATABASE_HOST ?? "")) {
  console.error(
    `Refusing to seed DATABASE_HOST="${process.env.DATABASE_HOST}". ` +
      "This script is for local test databases; pass --force to override.",
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  }),
});

const log = (message = "") => console.log(message);

// ---------------------------------------------------------------------------
// Date helpers (all wall-clock times are Adelaide, like the app)
// ---------------------------------------------------------------------------

// `n` days before today at HH:mm Adelaide time (negative n = in the future).
function daysAgo(n, time = "09:00") {
  const day = dayjs().tz(TZ).subtract(n, "day").format("YYYY-MM-DD");
  return dayjs.tz(`${day} ${time}`, TZ).toDate();
}

// The last `count` weekdays as YYYY-MM-DD, most recent first (today included).
function recentWeekdays(count) {
  const dates = [];
  let cursor = dayjs().tz(TZ);
  while (dates.length < count) {
    if (cursor.day() !== 0 && cursor.day() !== 6) {
      dates.push(cursor.format("YYYY-MM-DD"));
    }
    cursor = cursor.subtract(1, "day");
  }
  return dates;
}

// Small deterministic PRNG so punch times look organic but are repeatable.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const money = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Config constants (dropdown options used across the admin forms)
// ---------------------------------------------------------------------------

const CONFIG = {
  role: [
    "Production Manager",
    "Cabinet Maker",
    "Installer",
    "Drafter",
    "Office Administrator",
    "Apprentice",
  ],
  hardware: [
    "Hinges",
    "Drawer Runners",
    "Lift Systems",
    "Bin Systems",
    "Shelf Supports",
    "Legs & Feet",
  ],
  brand: [
    "Polytec",
    "Laminex",
    "Egger",
    "Sunmica",
    "Blum",
    "Hettich",
    "Hafele",
    "Hoop Pine",
  ],
  finish: ["Woodgrain", "Matte", "Super Matt", "Gloss", "Satin", "Raw"],
  measuring_unit: [
    "Sheets",
    "Rolls",
    "Pieces",
    "Pairs",
    "Packs",
    "Lengths",
    "Tubes",
    "Metres",
  ],
};

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const WEEKDAY_AVAILABILITY = JSON.stringify({
  monday: { start: "07:00", end: "15:30" },
  tuesday: { start: "07:00", end: "15:30" },
  wednesday: { start: "07:00", end: "15:30" },
  thursday: { start: "07:00", end: "15:30" },
  friday: { start: "07:00", end: "14:00" },
  saturday: { start: "", end: "" },
  sunday: { start: "", end: "" },
});

const MODULES = [
  "all_clients",
  "add_clients",
  "client_details",
  "dashboard",
  "delete_media",
  "all_employees",
  "add_employees",
  "employee_details",
  "all_projects",
  "add_projects",
  "project_details",
  "all_suppliers",
  "add_suppliers",
  "supplier_details",
  "all_items",
  "add_items",
  "item_details",
  "logs",
  "lotatglance",
  "materialstoorder",
  "purchaseorder",
  "statements",
  "site_photos",
  "config",
  "site_measurements",
  "usedmaterial",
  "calendar",
  "add_clock_punch",
  "clock_punch_details",
  "all_clock_punches",
];

const grant = (...names) => Object.fromEntries(names.map((n) => [n, true]));
const grantAllExcept = (...names) =>
  Object.fromEntries(
    MODULES.filter((m) => !names.includes(m)).map((m) => [m, true]),
  );

const FIELD_STAFF = [
  "dashboard",
  "all_projects",
  "project_details",
  "lotatglance",
  "calendar",
  "site_photos",
  "site_measurements",
  "add_clock_punch",
  "clock_punch_details",
];

// key -> account. `employee` links to EMPLOYEES by key.
const USERS = [
  {
    key: "master",
    username: "mock.master",
    user_type: "master-admin",
    access: grantAllExcept(),
  },
  {
    key: "admin",
    username: "mock.admin",
    user_type: "admin",
    employee: "hannah",
    access: grantAllExcept("config", "delete_media"),
  },
  // Manager can't manage HR records — handy for testing restricted access.
  {
    key: "manager",
    username: "mock.manager",
    user_type: "manager",
    employee: "dale",
    access: grantAllExcept(
      "config",
      "delete_media",
      "add_employees",
      "employee_details",
    ),
  },
  {
    key: "marcus",
    username: "mock.marcus",
    user_type: "employee",
    employee: "marcus",
    access: grant(...FIELD_STAFF, "usedmaterial", "all_items", "item_details"),
  },
  {
    key: "tran",
    username: "mock.tran",
    user_type: "employee",
    employee: "tran",
    access: grant(...FIELD_STAFF, "usedmaterial", "all_items", "item_details"),
  },
  {
    key: "priya",
    username: "mock.priya",
    user_type: "employee",
    employee: "priya",
    access: grant(...FIELD_STAFF),
  },
  {
    key: "callum",
    username: "mock.callum",
    user_type: "employee",
    employee: "callum",
    access: grant(...FIELD_STAFF),
  },
  {
    key: "sophie",
    username: "mock.sophie",
    user_type: "employee",
    employee: "sophie",
    access: grant(...FIELD_STAFF, "materialstoorder"),
  },
];

const EMPLOYEES = [
  {
    key: "dale",
    first_name: "Dale",
    last_name: "Whitfield",
    role: "Production Manager",
    phone: "0491 570 006",
    dob: "1982-03-09",
    join_days: 2900,
    education: "Trade certificate, Cabinet Making",
    notes: "Runs the workshop floor and approves production.",
  },
  {
    key: "marcus",
    first_name: "Marcus",
    last_name: "Feldman",
    role: "Cabinet Maker",
    phone: "0491 570 156",
    dob: "1989-04-17",
    join_days: 1700,
    education: "Cert III in Cabinet Making",
    notes: "Lead on CNC and assembly.",
  },
  {
    key: "tran",
    first_name: "Tran",
    last_name: "Nguyen",
    role: "Cabinet Maker",
    phone: "0491 570 157",
    dob: "1994-08-23",
    join_days: 900,
    education: "Cert III in Cabinet Making",
    notes: "Assembly and edging.",
  },
  {
    key: "priya",
    first_name: "Priya",
    last_name: "Raman",
    role: "Installer",
    phone: "0491 570 158",
    dob: "1993-11-02",
    join_days: 1100,
    education: "Cert IV in Building & Construction",
    notes: "Site measurements and installs.",
  },
  {
    key: "callum",
    first_name: "Callum",
    last_name: "Brooks",
    role: "Installer",
    phone: "0491 570 159",
    dob: "1997-01-30",
    join_days: 520,
    education: "Cert III in Carpentry",
    notes: "Installs and delivery runs.",
  },
  {
    key: "sophie",
    first_name: "Sophie",
    last_name: "Lindqvist",
    role: "Drafter",
    phone: "0491 570 110",
    dob: "1991-06-12",
    join_days: 1500,
    education: "Diploma of Interior Design",
    notes: "All drawings and material selections.",
  },
  {
    key: "hannah",
    first_name: "Hannah",
    last_name: "Okafor",
    role: "Office Administrator",
    phone: "0491 570 313",
    dob: "1988-09-05",
    join_days: 2300,
    education: "Diploma of Business",
    notes: "Quotes, purchasing, statements.",
  },
  // Former employee: shows the inactive state in the employee list.
  {
    key: "reece",
    first_name: "Reece",
    last_name: "Dolan",
    role: "Apprentice",
    phone: "0491 570 737",
    dob: "2002-12-14",
    join_days: 600,
    education: "Cert III in Cabinet Making (in progress)",
    notes: "Left in the last quarter.",
    inactive: true,
  },
];

const CLIENTS = [
  {
    key: "lakeside",
    name: "Lakeside Builders",
    slug: "MKLB",
    type: "builder",
    address: "72 Grand Junction Road, Rosewater SA 5013",
    phone: "08 8447 1200",
    email: "projects@lakeside-builders.example.com",
    website: "https://lakeside-builders.example.com",
    notes: "Repeat builder, 4 to 6 kitchens a year.",
    contacts: [
      ["Elena", "Bettencourt", "Project Manager", "email"],
      ["Gus", "Papadakis", "Site Supervisor", "phone"],
    ],
  },
  {
    key: "harcourt",
    name: "Harcourt Family",
    slug: "MKHF",
    type: "private",
    address: "26 Kensington Road, Norwood SA 5067",
    phone: "0408 555 331",
    email: "j.harcourt@example.com",
    website: null,
    notes: "Private renovation. Homeowner is on site most days.",
    contacts: [["Jordan", "Harcourt", "Homeowner", "phone"]],
  },
  {
    key: "northpoint",
    name: "Northpoint Developments",
    slug: "MKND",
    type: "builder",
    address: "10 Peachey Road, Davoren Park SA 5113",
    phone: "08 8255 4400",
    email: "builds@northpoint.example.com",
    website: "https://northpoint.example.com",
    notes: "Townhouse developer, multi-lot packages.",
    contacts: [
      ["Tomas", "Kraft", "Site Supervisor", "phone"],
      ["Mei", "Zhang", "Accounts", "email"],
    ],
  },
  {
    key: "oceanview",
    name: "Ocean View Apartments Pty Ltd",
    slug: "MKOV",
    type: "other",
    address: "Level 4, 18 Jetty Road, Glenelg SA 5045",
    phone: "08 8294 7700",
    email: "development@oceanview.example.com",
    website: "https://oceanview.example.com",
    notes: "Apartment fit-out, tight programme.",
    contacts: [["Rafael", "Santos", "Development Manager", "email"]],
  },
  {
    key: "okonkwo",
    name: "The Okonkwo Residence",
    slug: "MKOK",
    type: "private",
    address: "5 Burnside Avenue, Burnside SA 5066",
    phone: "0409 555 214",
    email: "c.okonkwo@example.com",
    website: null,
    notes: "Wardrobes and vanities across the house.",
    contacts: [["Chidi", "Okonkwo", "Homeowner", "email"]],
  },
  // Soft-deleted client: should not appear in lists.
  {
    key: "redgum",
    name: "Redgum Constructions",
    slug: "MKRG",
    type: "builder",
    address: "3 Industrial Drive, Wingfield SA 5013",
    phone: "08 8260 1100",
    email: "info@redgum.example.com",
    website: null,
    notes: "Account closed.",
    deleted: true,
    contacts: [],
  },
];

const SUPPLIERS = [
  {
    key: "spanel",
    name: "Southern Panel Supplies",
    address: "41 Port Wakefield Road, Gepps Cross SA 5094",
    phone: "08 8349 2200",
    email: "orders@southernpanel.example.com",
    website: "https://southernpanel.example.com",
    abn: "51 824 753 556",
    notes: "Sheets and boards. Free delivery over $1,500.",
    contacts: [
      ["Shane", "McAllister", "Account Manager"],
      ["Beth", "Yuen", "Dispatch"],
    ],
  },
  {
    key: "ahub",
    name: "Hardware Hub SA",
    address: "9 Sir Donald Bradman Drive, Hilton SA 5033",
    phone: "08 8352 6600",
    email: "trade@hardwarehub.example.com",
    website: "https://hardwarehub.example.com",
    abn: "33 102 465 330",
    notes: "Blum and Hettich trade account.",
    contacts: [["Marnie", "Gallagher", "Trade Desk"]],
  },
  {
    key: "etape",
    name: "Edge & Tape Co.",
    address: "14 Cavan Road, Dry Creek SA 5094",
    phone: "08 8260 9900",
    email: "sales@edgeandtape.example.com",
    website: null,
    notes: "Edging, 2 day turnaround.",
    contacts: [["Ravi", "Kapoor", "Sales"]],
  },
  {
    key: "hhaus",
    name: "Handle Haus",
    address: "88 Magill Road, Norwood SA 5067",
    phone: "08 8331 5050",
    email: "wholesale@handlehaus.example.com",
    website: "https://handlehaus.example.com",
    abn: "72 449 018 227",
    notes: "Handles and knobs, custom colours on request.",
    contacts: [["Imogen", "Fraser", "Wholesale"]],
  },
  {
    key: "acf",
    name: "Adelaide Cabinet Fittings",
    address: "6 Richmond Road, Keswick SA 5035",
    phone: "08 8293 4400",
    email: "orders@adelaidefittings.example.com",
    website: "https://adelaidefittings.example.com",
    abn: "64 310 772 904",
    notes: "General fittings and accessories.",
    contacts: [["Dom", "Rossi", "Sales"]],
  },
  // Soft-deleted supplier.
  {
    key: "old",
    name: "Old Timber Merchants",
    address: "1 Mill Lane, Mount Barker SA 5251",
    phone: "08 8391 0000",
    email: "hello@oldtimber.example.com",
    website: null,
    abn: null,
    notes: "No longer trading.",
    deleted: true,
    contacts: [],
  },
];

// ---------------------------------------------------------------------------
// Inventory
// `sup` is [supplierKey, supplierReference, unitPrice] per supplier that stocks it.
// `open` is the opening stock before any of the movements below are applied.
// ---------------------------------------------------------------------------

const sheet = (
  key,
  description,
  brand,
  color,
  finish,
  face,
  dimensions,
  min,
  open,
  sup,
  extra = {},
) => ({
  key,
  category: "SHEET",
  description,
  unit: "Sheets",
  min,
  open,
  sup,
  detail: {
    brand,
    color,
    finish,
    face,
    dimensions,
    is_sunmica: false,
    ...extra,
  },
});
const tape = (key, description, brand, color, finish, min, open, sup) => ({
  key,
  category: "EDGING_TAPE",
  description,
  unit: "Rolls",
  min,
  open,
  sup,
  detail: { brand, color, finish, dimensions: "22mm x 1mm x 100m" },
});
const handle = (
  key,
  description,
  brand,
  color,
  type,
  dimensions,
  material,
  unit,
  min,
  open,
  sup,
) => ({
  key,
  category: "HANDLE",
  description,
  unit,
  min,
  open,
  sup,
  detail: { brand, color, type, dimensions, material },
});
const hardware = (
  key,
  description,
  brand,
  name,
  type,
  dimensions,
  sub_category,
  unit,
  min,
  open,
  sup,
) => ({
  key,
  category: "HARDWARE",
  description,
  unit,
  min,
  open,
  sup,
  detail: { brand, name, type, dimensions, sub_category },
});
const accessory = (key, description, name, unit, min, open, sup) => ({
  key,
  category: "ACCESSORY",
  description,
  unit,
  min,
  open,
  sup,
  detail: { name },
});

const ITEMS = [
  sheet(
    "oak",
    "Polytec Nordic Oak 18mm melamine",
    "Polytec",
    "Nordic Oak",
    "Woodgrain",
    "Double sided",
    "2400 x 1200 x 18mm",
    10,
    10,
    [["spanel", "PP-NOAK-18", 89.5]],
  ),
  sheet(
    "white",
    "Polytec Snow Matt 18mm melamine",
    "Polytec",
    "Snow",
    "Matte",
    "Double sided",
    "2400 x 1200 x 18mm",
    12,
    12,
    [["spanel", "PP-SNOW-18", 82]],
  ),
  sheet(
    "black",
    "Laminex Black Matt 18mm melamine",
    "Laminex",
    "Black",
    "Super Matt",
    "Double sided",
    "2400 x 1200 x 18mm",
    6,
    5,
    [["spanel", "LX-BLK-18", 98]],
  ),
  sheet(
    "grey",
    "Egger Light Grey 16mm melamine",
    "Egger",
    "Light Grey",
    "Matte",
    "Double sided",
    "2800 x 2070 x 16mm",
    6,
    22,
    [["spanel", "EG-LGR-16", 74]],
  ),
  sheet(
    "ply",
    "Birch plywood 18mm",
    "Hoop Pine",
    "Natural",
    "Raw",
    "Single sided",
    "2400 x 1200 x 18mm",
    4,
    6,
    [["spanel", "BP-18", 112]],
  ),
  sheet(
    "mdf",
    "Raw MDF 16mm",
    "Egger",
    "Raw",
    "Raw",
    "Double sided",
    "2400 x 1200 x 16mm",
    10,
    20,
    [["spanel", "MDF-16", 38]],
  ),
  sheet(
    "swalnut",
    "Sunmica Walnut Gloss laminate",
    "Sunmica",
    "Walnut",
    "Gloss",
    "Single sided",
    "3050 x 1300 x 1mm",
    4,
    3,
    [["spanel", "SM-WAL-G", 118]],
    { is_sunmica: true },
  ),
  sheet(
    "swhite",
    "Sunmica Pure White Satin laminate",
    "Sunmica",
    "Pure White",
    "Satin",
    "Single sided",
    "3050 x 1300 x 1mm",
    4,
    9,
    [["spanel", "SM-PWH-S", 96]],
    { is_sunmica: true },
  ),

  tape(
    "t_oak",
    "ABS edging Nordic Oak",
    "Polytec",
    "Nordic Oak",
    "Woodgrain",
    3,
    2,
    [["etape", "ET-NOAK", 48]],
  ),
  tape("t_white", "ABS edging Snow Matt", "Polytec", "Snow", "Matte", 3, 9, [
    ["etape", "ET-SNOW", 48],
  ]),
  tape(
    "t_black",
    "ABS edging Black Matt",
    "Laminex",
    "Black",
    "Super Matt",
    2,
    4,
    [["etape", "ET-BLK", 52]],
  ),
  tape(
    "t_grey",
    "ABS edging Light Grey",
    "Egger",
    "Light Grey",
    "Matte",
    2,
    0,
    [["etape", "ET-LGR", 46]],
  ),
  tape("t_walnut", "ABS edging Walnut", "Sunmica", "Walnut", "Gloss", 1, 2, [
    ["etape", "ET-WAL", 55],
  ]),

  handle(
    "h_bar",
    "Bar handle 160mm Matte Black",
    "Handle Haus",
    "Matte Black",
    "Bar",
    "160mm",
    "Aluminium",
    "Pieces",
    40,
    30,
    [
      ["hhaus", "HH-BAR160-MB", 4.8],
      ["acf", "ACF-H160B", 5.2],
    ],
  ),
  handle(
    "h_bar2",
    "Bar handle 320mm Matte Black",
    "Handle Haus",
    "Matte Black",
    "Bar",
    "320mm",
    "Aluminium",
    "Pieces",
    20,
    25,
    [["hhaus", "HH-BAR320-MB", 7.4]],
  ),
  handle(
    "h_knob",
    "Round knob 30mm Brushed Brass",
    "Handle Haus",
    "Brushed Brass",
    "Knob",
    "30mm",
    "Zinc alloy",
    "Pieces",
    30,
    55,
    [["hhaus", "HH-KNB30-BB", 3.2]],
  ),
  handle(
    "h_tbar",
    "T-bar handle 192mm Stainless",
    "Handle Haus",
    "Stainless",
    "T-Bar",
    "192mm",
    "Stainless steel",
    "Pieces",
    20,
    12,
    [
      ["hhaus", "HH-TB192-SS", 6.1],
      ["acf", "ACF-TB192", 6.4],
    ],
  ),
  handle(
    "h_finger",
    "Finger pull profile aluminium 3m",
    "Handle Haus",
    "Anodised",
    "Finger Pull",
    "3000mm",
    "Aluminium",
    "Lengths",
    10,
    18,
    [["hhaus", "HH-FP3000", 21.5]],
  ),

  hardware(
    "hinge",
    "Clip Top 110 degree soft close hinge",
    "Blum",
    "Clip Top Blumotion",
    "Soft close",
    "110 degree",
    "Hinges",
    "Pieces",
    100,
    150,
    [
      ["ahub", "BL-71B3550", 2.95],
      ["acf", "ACF-BL3550", 3.1],
    ],
  ),
  hardware(
    "plate",
    "Clip Top mounting plate 0mm",
    "Blum",
    "Mounting plate",
    "Cruciform",
    "0mm",
    "Hinges",
    "Pieces",
    100,
    80,
    [["ahub", "BL-173L6100", 0.85]],
  ),
  hardware(
    "runner",
    "Tandem 500mm drawer runner pair",
    "Blum",
    "Tandem Blumotion",
    "Soft close",
    "500mm",
    "Drawer Runners",
    "Pairs",
    20,
    10,
    [["ahub", "BL-563H5000", 11.4]],
  ),
  hardware(
    "lift",
    "Aventos HK-S lift system",
    "Blum",
    "Aventos HK-S",
    "Lift up",
    "Standard",
    "Lift Systems",
    "Pieces",
    4,
    6,
    [["ahub", "BL-20K1B00", 34.9]],
  ),
  hardware(
    "bin",
    "Pull-out bin double 450mm",
    "Hettich",
    "Bin double",
    "Pull out",
    "450mm",
    "Bin Systems",
    "Pieces",
    3,
    5,
    [
      ["ahub", "HT-BIN450", 96],
      ["acf", "ACF-BIN450", 99],
    ],
  ),
  hardware(
    "shelf",
    "Shelf support 5mm nickel (pack of 100)",
    "Hafele",
    "Shelf pin",
    "Pin",
    "5mm",
    "Shelf Supports",
    "Packs",
    5,
    14,
    [["acf", "HF-SP5N-100", 9.2]],
  ),
  hardware(
    "leg",
    "Adjustable cabinet leg 100mm",
    "Hafele",
    "Cabinet leg",
    "Adjustable",
    "100mm",
    "Legs & Feet",
    "Pieces",
    100,
    60,
    [
      ["acf", "HF-LEG100", 1.2],
      ["ahub", "HH-LEG100", 1.35],
    ],
  ),

  accessory(
    "cutlery",
    "Cutlery tray 450mm",
    "Cutlery tray 450mm",
    "Pieces",
    3,
    6,
    [["acf", "ACF-CT450", 18]],
  ),
  accessory(
    "led",
    "LED strip 3m warm white 24V",
    "LED strip 3m",
    "Pieces",
    5,
    8,
    [["acf", "ACF-LED3WW", 24]],
  ),
  accessory("damper", "Soft close damper kit", "Damper kit", "Packs", 10, 22, [
    ["acf", "ACF-SCD", 6.5],
    ["ahub", "HH-SCD", 6.9],
  ]),
  accessory(
    "sealant",
    "Neutral cure silicone clear",
    "Silicone clear",
    "Tubes",
    6,
    10,
    [["acf", "ACF-SIL-CL", 7.8]],
  ),
];

// ---------------------------------------------------------------------------
// Projects, lots and the 16-stage workflow
// ---------------------------------------------------------------------------

// Canonical order, mirrored from the dashboard route.
const STAGES = [
  "quote approve",
  "material & appliances selection",
  "drafting",
  "drafting revision",
  "final design approval",
  "site measurements",
  "final approval for production",
  "machining out",
  "material order",
  "cnc",
  "assembly",
  "delivery",
  "installation",
  "invoice sent",
  "maintenance",
  "job completion",
];
const STAGE_DAYS = [2, 3, 5, 3, 4, 2, 2, 3, 4, 3, 5, 1, 4, 1, 3, 1];

// Who normally owns each stage. "installer" resolves to the lot's installer.
const STAGE_OWNERS = {
  "quote approve": ["hannah"],
  "material & appliances selection": ["sophie"],
  drafting: ["sophie"],
  "drafting revision": ["sophie"],
  "final design approval": ["sophie", "dale"],
  "site measurements": ["installer"],
  "final approval for production": ["dale"],
  "machining out": ["marcus"],
  "material order": ["hannah"],
  cnc: ["marcus", "tran"],
  assembly: ["tran", "marcus"],
  delivery: ["installer", "dale"],
  installation: ["installer"],
  "invoice sent": ["hannah"],
  maintenance: ["installer"],
  "job completion": ["dale"],
};

// `progress` is the stage currently IN_PROGRESS; earlier stages are DONE.
// A COMPLETED lot has every stage DONE. Offsets are days relative to today.
const PROJECTS = [
  {
    key: "P1",
    client: "lakeside",
    name: "Lakeside Estate Stage 2",
    start: -48,
    lots: [
      {
        key: "P1-L1",
        name: "Lot 14 — 8 Wattle Grove",
        progress: "cnc",
        start: -48,
        due: 16,
        installer: "priya",
        notes: "Kitchen, butler's pantry and laundry. Stone tops by others.",
        selection: "S1",
      },
      {
        key: "P1-L2",
        name: "Lot 15 — 10 Wattle Grove",
        progress: "material order",
        start: -40,
        due: 24,
        installer: "priya",
        overdueStage: true,
        notes: "Mirror of Lot 14 with a different door finish.",
      },
      {
        key: "P1-L3",
        name: "Lot 16 — 12 Wattle Grove",
        progress: "drafting",
        start: -22,
        due: 45,
        installer: "callum",
        notes: "Awaiting updated appliance schedule from the builder.",
        changes: "Builder moved the fridge recess 150mm left.",
      },
    ],
  },
  {
    key: "P2",
    client: "harcourt",
    name: "Harcourt Kitchen & Laundry",
    start: -62,
    lots: [
      {
        key: "P2-L1",
        name: "Kitchen",
        progress: "installation",
        start: -62,
        due: 3,
        installer: "callum",
        notes: "Full strip-out and refit. Matte black hardware selected.",
        selection: "S2",
        changes: "Client asked to swap the bin drawer to the sink run.",
      },
      {
        key: "P2-L2",
        name: "Laundry",
        progress: "final design approval",
        start: -30,
        due: 30,
        installer: "callum",
        notes: "Starts once the kitchen is installed.",
        selection: "S3",
      },
    ],
  },
  {
    key: "P3",
    client: "northpoint",
    name: "Davoren Park Townhouses",
    start: -110,
    lots: [
      {
        key: "P3-L1",
        name: "Townhouse A",
        status: "COMPLETED",
        start: -110,
        due: -20,
        installer: "priya",
        notes: "Completed and handed over. Kept for the maintenance record.",
        selection: "S4",
      },
      {
        key: "P3-L2",
        name: "Townhouse B",
        progress: "assembly",
        start: -80,
        due: 7,
        installer: "priya",
        notes: "Delayed by the site slab pour.",
      },
      {
        key: "P3-L3",
        name: "Townhouse C",
        progress: "quote approve",
        start: -6,
        due: 80,
        installer: "callum",
        notes: "Quote submitted, waiting on sign-off.",
      },
      {
        key: "P3-L4",
        name: "Townhouse D",
        status: "CANCELLED",
        progress: "drafting",
        start: -70,
        due: 40,
        installer: null,
        notes: "Cancelled by the developer. Do not proceed.",
      },
    ],
  },
  {
    key: "P4",
    client: "oceanview",
    name: "Ocean View Level 3 Fit-out",
    start: -90,
    lots: [
      {
        key: "P4-L1",
        name: "Apartment 301",
        progress: "site measurements",
        start: -35,
        due: 20,
        installer: "priya",
        notes: "Site measure booked, access via the loading dock.",
        selection: "S5",
      },
      {
        key: "P4-L2",
        name: "Apartment 302",
        progress: "final approval for production",
        start: -33,
        due: 22,
        installer: "priya",
        overdueStage: true,
        notes: "Drawings signed off, awaiting production release.",
      },
      {
        key: "P4-L3",
        name: "Apartment 303",
        progress: "delivery",
        start: -90,
        due: -3,
        installer: "callum",
        notes: "Overdue — builder couldn't take delivery last week.",
        na: ["drafting revision", "maintenance"],
      },
    ],
  },
  {
    key: "P5",
    client: "okonkwo",
    name: "Okonkwo Wardrobes & Vanities",
    start: -150,
    lots: [
      {
        key: "P5-L1",
        name: "Master walk-in robe",
        progress: "maintenance",
        start: -150,
        due: -40,
        installer: "callum",
        notes:
          "Installed. Client reported a sticking drawer, booked for adjustment.",
        na: [],
      },
      {
        key: "P5-L2",
        name: "Ensuite vanity",
        progress: "invoice sent",
        start: -100,
        due: -14,
        installer: "priya",
        notes: "Installed, invoice out.",
        na: [],
      },
    ],
  },
];

// Placeholder notes for the tabs a lot has reached by its current stage.
function tabsFor(lot, stageIndex) {
  const tabs = [];
  const add = (tab, notes) => tabs.push({ tab, notes });
  if (stageIndex >= 2)
    add("ARCHITECTURE_DRAWINGS", "Drawings received from the builder.");
  if (stageIndex >= 2)
    add(
      "APPLIANCES_SPECIFICATIONS",
      "Appliance spec sheets saved against the lot.",
    );
  if (stageIndex >= 4)
    add("MATERIAL_SELECTION", "Selections confirmed with the client.");
  if (stageIndex >= 5)
    add(
      "SITE_MEASUREMENTS",
      "Measured on site. Walls out of square by up to 8mm.",
    );
  if (stageIndex >= 6)
    add("CABINETRY_DRAWINGS", "Shop drawings signed off, cut list released.");
  if (stageIndex >= 11)
    add("DELIVERY_PHOTOS", "Delivery photos taken at drop-off.");
  if (stageIndex >= 12)
    add("INSTALLATION_PHOTOS", "Installation progress photos.");
  if (stageIndex >= 14)
    add("MAINTENANCE_PHOTOS", "Follow-up photos from the maintenance visit.");
  if (stageIndex >= 15)
    add("FINISHED_SITE_PHOTOS", "Photos taken at practical completion.");
  if (lot.changes) add("CHANGES_TO_DO", lot.changes);
  return tabs;
}

// ---------------------------------------------------------------------------
// Material selections (areas and items follow MaterialSelectionConstants.jsx)
// ---------------------------------------------------------------------------

const AREA_ITEMS = {
  Kitchen: [
    "Overhead Cabinets",
    "LED Provision under overhead cabinets",
    "Underbench Drawers/Cabinets",
    "Tall Cupboards",
    "Integrated Dishwasher",
    "Benchtop",
    "Pull out bin with double baskets",
    "Ways to open drawers",
  ],
  "Kitchen Island": [
    "Underbench Drawers/Cabinets",
    "Back Panel",
    "One side water fall",
    "Integrated Dishwasher",
    "Benchtop",
  ],
  Laundry: [
    "Overhead Cabinets",
    "Underbench Drawers/Cabinets",
    "Hamper",
    "Handles",
    "Push to Open",
    "Benchtop",
  ],
  "Bath Vanity": [
    "Underbench Cabinets",
    "Extra drawer",
    "Handles",
    "Wall Hung",
    "LED Provision",
    "Benchtop",
  ],
};
const BED_ITEMS = {
  WIR: [
    "Drawer Tower, Open Shelves with Handging Rail",
    "Double hanging rail",
    "LED Provision",
    "Overhead Cabinets",
    "Handles",
  ],
  Vanity: ["Underbench Cabinets", "Extra drawer", "Handles", "Benchtop"],
};

// An area where `on` lists the applicable items and `notes` annotates some.
const area = (name, on, notes = {}, areaNotes = null) => ({
  name,
  notes: areaNotes,
  items: AREA_ITEMS[name].map((item) => ({
    name: item,
    category: null,
    applicable: on.includes(item),
    notes: notes[item] ?? null,
  })),
});
const bedArea = (name, option, onWir, onVanity, notes = {}) => ({
  name,
  bed_option: option,
  notes: null,
  items: [
    ...BED_ITEMS[option].map((item) => ({
      name: item,
      category: option,
      applicable: onWir.includes(item),
      notes: notes[item] ?? null,
    })),
    ...BED_ITEMS.Vanity.map((item) => ({
      name: item,
      category: "Vanity",
      applicable: onVanity.includes(item),
      notes: null,
    })),
  ],
});

const HEIGHTS = { ceiling: 2700, bulkhead: 450, kicker: 150, cabinetry: 2400 };

const SELECTIONS = {
  S1: {
    quote: "Q-MOCK-1041",
    by: "sophie",
    versions: [
      {
        notes: "First pass, before the builder moved the pantry wall.",
        heights: HEIGHTS,
        areas: [
          area("Kitchen", [
            "Overhead Cabinets",
            "Underbench Drawers/Cabinets",
            "Benchtop",
          ]),
          area("Laundry", ["Overhead Cabinets", "Benchtop"]),
        ],
      },
      {
        notes:
          "Revised after the pantry wall moved. Added island and integrated dishwasher.",
        heights: HEIGHTS,
        areas: [
          area(
            "Kitchen",
            [
              "Overhead Cabinets",
              "LED Provision under overhead cabinets",
              "Underbench Drawers/Cabinets",
              "Tall Cupboards",
              "Integrated Dishwasher",
              "Benchtop",
              "Pull out bin with double baskets",
            ],
            { Benchtop: "Stone by others, 20mm overhang" },
          ),
          area(
            "Kitchen Island",
            [
              "Underbench Drawers/Cabinets",
              "Back Panel",
              "One side water fall",
              "Benchtop",
            ],
            { "One side water fall": "Stone water fall by others" },
          ),
          area("Laundry", [
            "Overhead Cabinets",
            "Underbench Drawers/Cabinets",
            "Handles",
            "Benchtop",
          ]),
        ],
      },
    ],
  },
  S2: {
    quote: "Q-MOCK-1052",
    by: "sophie",
    versions: [
      {
        notes: "Matte black hardware throughout.",
        heights: { ...HEIGHTS, ceiling: 2550 },
        areas: [
          area(
            "Kitchen",
            [
              "Overhead Cabinets",
              "Underbench Drawers/Cabinets",
              "Tall Cupboards",
              "Integrated Dishwasher",
              "Benchtop",
              "Pull out bin with double baskets",
              "Ways to open drawers",
            ],
            {
              "Ways to open drawers":
                "Bar handles on drawers, push to open on overheads",
            },
            "Client wants no handles on the pantry doors.",
          ),
        ],
      },
    ],
  },
  S3: {
    quote: "Q-MOCK-1053",
    by: "sophie",
    versions: [
      {
        notes: "Laundry to match the kitchen.",
        heights: { ...HEIGHTS, ceiling: 2550 },
        areas: [
          area("Laundry", [
            "Overhead Cabinets",
            "Underbench Drawers/Cabinets",
            "Hamper",
            "Handles",
            "Benchtop",
          ]),
        ],
      },
    ],
  },
  S4: {
    quote: "Q-MOCK-0987",
    by: "sophie",
    versions: [
      {
        notes: "Final signed-off selection.",
        heights: HEIGHTS,
        areas: [
          area("Kitchen", [
            "Overhead Cabinets",
            "Underbench Drawers/Cabinets",
            "Tall Cupboards",
            "Benchtop",
          ]),
          bedArea(
            "Bed 1",
            "WIR",
            ["Double hanging rail", "LED Provision", "Handles"],
            ["Underbench Cabinets", "Benchtop"],
          ),
        ],
      },
    ],
  },
  S5: {
    quote: "Q-MOCK-1076",
    by: "sophie",
    versions: [
      {
        notes: "Apartment standard package.",
        heights: { ...HEIGHTS, ceiling: 2400 },
        areas: [
          area("Kitchen", [
            "Overhead Cabinets",
            "Underbench Drawers/Cabinets",
            "Integrated Dishwasher",
            "Benchtop",
          ]),
          area("Bath Vanity", [
            "Underbench Cabinets",
            "Handles",
            "Wall Hung",
            "Benchtop",
          ]),
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Procurement: materials-to-order, purchase orders and stock movements.
// Quantities flow through simulateInventory() so item stock, MTO coverage and
// PO status always agree with each other, the way the API would leave them.
// ---------------------------------------------------------------------------

// `lines` are [itemKey, quantity, manualQuantityOrdered?]
const MTOS = [
  {
    key: "m1",
    project: "P1",
    lots: ["P1-L1", "P1-L2"],
    by: "dale",
    days: 44,
    notes: "Lakeside Stage 2 — Lots 14 and 15 combined order.",
    lines: [
      ["oak", 30],
      ["white", 18],
      ["t_oak", 6],
      ["t_white", 4],
      ["hinge", 120],
      ["runner", 40],
      ["h_bar", 60],
      ["leg", 80],
    ],
  },
  {
    key: "m2",
    project: "P2",
    lots: ["P2-L1"],
    by: "hannah",
    days: 26,
    notes: "Harcourt kitchen.",
    lines: [
      ["oak", 14],
      ["h_bar", 22],
      ["hinge", 36],
      ["runner", 14],
      ["led", 4, 4],
    ],
  },
  {
    key: "m3",
    project: "P3",
    lots: ["P3-L1"],
    by: "dale",
    days: 108,
    closed: true,
    notes: "Townhouse A. Fully used and closed out.",
    lines: [
      ["grey", 20],
      ["white", 10],
      ["t_grey", 4],
      ["t_white", 3],
      ["h_tbar", 24],
      ["hinge", 48],
      ["shelf", 6],
    ],
  },
  {
    key: "m4",
    project: "P3",
    lots: ["P3-L2"],
    by: "dale",
    days: 34,
    notes: "Townhouse B. Part covered from stock.",
    lines: [
      ["grey", 16],
      ["white", 8],
      ["t_grey", 3, 3],
      ["h_tbar", 20],
      ["hinge", 40],
      ["runner", 18],
    ],
  },
  {
    key: "m5",
    project: "P4",
    lots: ["P4-L3"],
    by: "hannah",
    days: 60,
    notes: "Apartment 303.",
    lines: [
      ["swalnut", 6],
      ["swhite", 4],
      ["h_finger", 14],
      ["hinge", 30],
      ["bin", 3],
      ["cutlery", 3],
      ["damper", 6],
    ],
  },
  {
    key: "m6",
    project: "P2",
    lots: ["P2-L2"],
    by: "sophie",
    days: 3,
    notes: "Draft — waiting on final design approval.",
    lines: [
      ["ply", 8],
      ["swhite", 2],
      ["h_knob", 20],
      ["shelf", 4],
    ],
  },
];

// `lines` are [itemKey, quantity, unitPrice, received]. A PO with an `mto`
// counts its lines against that MTO (cancelled POs give the quantity back).
const POS = [
  {
    no: "MOCK-PO-0001",
    supplier: "spanel",
    mto: "m1",
    status: "FULLY_RECEIVED",
    days: 38,
    received: 31,
    delivery: 85,
    by: "hannah",
    notes: "Delivered to workshop.",
    lines: [
      ["oak", 30, 89.5, 30],
      ["white", 18, 82, 18],
    ],
  },
  {
    no: "MOCK-PO-0002",
    supplier: "ahub",
    mto: "m1",
    status: "PARTIALLY_RECEIVED",
    days: 20,
    received: 14,
    delivery: 0,
    by: "hannah",
    notes: "Runners on back-order, legs not yet shipped.",
    lines: [
      ["hinge", 120, 2.95, 120],
      ["runner", 40, 11.4, 25],
      ["leg", 80, 1.2, 0],
    ],
  },
  {
    no: "MOCK-PO-0003",
    supplier: "etape",
    mto: "m1",
    status: "ORDERED",
    days: 12,
    expect: 3,
    delivery: 15,
    by: "hannah",
    notes: null,
    lines: [
      ["t_oak", 6, 48, 0],
      ["t_white", 4, 48, 0],
    ],
  },
  {
    no: "MOCK-PO-0004",
    supplier: "hhaus",
    mto: "m1",
    status: "ORDERED",
    days: 10,
    expect: -2,
    delivery: 0,
    by: "hannah",
    notes:
      "Matte black, check colour batch on arrival. Running late, supplier chased.",
    lines: [["h_bar", 60, 4.8, 0]],
  },
  {
    no: "MOCK-PO-0005",
    supplier: "spanel",
    mto: "m2",
    status: "FULLY_RECEIVED",
    days: 25,
    received: 19,
    delivery: 85,
    by: "hannah",
    notes: null,
    lines: [["oak", 14, 89.5, 14]],
  },
  {
    no: "MOCK-PO-0006",
    supplier: "hhaus",
    mto: "m2",
    status: "FULLY_RECEIVED",
    days: 22,
    received: 15,
    delivery: 0,
    by: "hannah",
    notes: null,
    lines: [["h_bar", 22, 4.8, 22]],
  },
  {
    no: "MOCK-PO-0007",
    supplier: "ahub",
    mto: "m2",
    status: "DRAFT",
    days: 2,
    delivery: 0,
    by: "hannah",
    notes: "Hinges only for now — runners to follow once the layout is final.",
    lines: [["hinge", 36, 2.95, 0]],
  },
  {
    no: "MOCK-PO-0008",
    supplier: "spanel",
    mto: "m3",
    status: "FULLY_RECEIVED",
    days: 105,
    received: 98,
    delivery: 85,
    by: "dale",
    notes: null,
    lines: [
      ["grey", 20, 74, 20],
      ["white", 10, 82, 10],
    ],
  },
  {
    no: "MOCK-PO-0009",
    supplier: "acf",
    mto: "m3",
    status: "FULLY_RECEIVED",
    days: 104,
    received: 99,
    delivery: 0,
    by: "dale",
    notes: null,
    lines: [
      ["hinge", 48, 3.1, 48],
      ["shelf", 6, 9.2, 6],
      ["h_tbar", 24, 6.4, 24],
    ],
  },
  {
    no: "MOCK-PO-0010",
    supplier: "etape",
    mto: "m3",
    status: "FULLY_RECEIVED",
    days: 104,
    received: 100,
    delivery: 15,
    by: "dale",
    notes: null,
    lines: [
      ["t_grey", 4, 46, 4],
      ["t_white", 3, 48, 3],
    ],
  },
  {
    no: "MOCK-PO-0011",
    supplier: "etape",
    mto: "m4",
    status: "CANCELLED",
    days: 30,
    delivery: 0,
    by: "dale",
    notes: "Cancelled — re-ordered by phone with a better price.",
    lines: [["t_grey", 3, 46, 0]],
  },
  {
    no: "MOCK-PO-0012",
    supplier: "spanel",
    mto: "m4",
    status: "ORDERED",
    days: 8,
    expect: 4,
    delivery: 85,
    by: "dale",
    notes: null,
    lines: [["grey", 16, 74, 0]],
  },
  {
    no: "MOCK-PO-0013",
    supplier: "spanel",
    mto: "m5",
    status: "PARTIALLY_RECEIVED",
    days: 50,
    received: 40,
    delivery: 85,
    by: "hannah",
    notes: "Walnut split across two deliveries.",
    lines: [
      ["swalnut", 6, 118, 3],
      ["swhite", 4, 96, 4],
    ],
  },
  {
    no: "MOCK-PO-0014",
    supplier: "acf",
    mto: "m5",
    status: "FULLY_RECEIVED",
    days: 55,
    received: 47,
    delivery: 0,
    by: "hannah",
    notes: null,
    lines: [
      ["hinge", 30, 3.1, 30],
      ["bin", 3, 99, 3],
      ["cutlery", 3, 18, 3],
      ["damper", 6, 6.5, 6],
    ],
  },
  {
    no: "MOCK-PO-0015",
    supplier: "hhaus",
    mto: "m5",
    status: "FULLY_RECEIVED",
    days: 52,
    received: 45,
    delivery: 0,
    by: "hannah",
    notes: null,
    lines: [["h_finger", 14, 21.5, 14]],
  },
  // Stock top-ups not tied to any MTO.
  {
    no: "MOCK-PO-0016",
    supplier: "spanel",
    mto: null,
    status: "ORDERED",
    days: 6,
    expect: 5,
    delivery: 85,
    by: "hannah",
    notes: "Monthly stock top-up.",
    lines: [
      ["black", 10, 98, 0],
      ["mdf", 20, 38, 0],
    ],
  },
  {
    no: "MOCK-PO-0017",
    supplier: "hhaus",
    mto: null,
    status: "DRAFT",
    days: 1,
    delivery: 0,
    by: "hannah",
    notes: null,
    lines: [["h_knob", 50, 3.2, 0]],
  },
];

// Everything that moves stock, applied oldest first. Quantities use the same
// rules as the API: reservations are drawn down before regular stock.
const MOVEMENTS = [
  { kind: "reserve", days: 3, mto: "m4", item: "white", qty: 8, user: "dale" },
  { kind: "reserve", days: 3, mto: "m4", item: "runner", qty: 6, user: "dale" },
  { kind: "reserve", days: 3, mto: "m4", item: "hinge", qty: 20, user: "dale" },

  { kind: "use", days: 90, mto: "m3", item: "grey", qty: 20 },
  { kind: "use", days: 90, mto: "m3", item: "white", qty: 10 },
  { kind: "use", days: 88, mto: "m3", item: "t_grey", qty: 4 },
  { kind: "use", days: 88, mto: "m3", item: "t_white", qty: 3 },
  { kind: "use", days: 70, mto: "m3", item: "h_tbar", qty: 24 },
  { kind: "use", days: 70, mto: "m3", item: "hinge", qty: 48 },
  { kind: "use", days: 70, mto: "m3", item: "shelf", qty: 6 },

  { kind: "use", days: 12, mto: "m2", item: "oak", qty: 14 },
  { kind: "use", days: 5, mto: "m2", item: "h_bar", qty: 22 },
  { kind: "use", days: 9, mto: "m1", item: "oak", qty: 12 },
  { kind: "use", days: 9, mto: "m1", item: "white", qty: 6 },
  { kind: "use", days: 8, mto: "m1", item: "hinge", qty: 40 },

  { kind: "use", days: 20, mto: "m5", item: "hinge", qty: 30 },
  { kind: "use", days: 20, mto: "m5", item: "bin", qty: 3 },
  { kind: "use", days: 20, mto: "m5", item: "cutlery", qty: 3 },
  { kind: "use", days: 18, mto: "m5", item: "damper", qty: 4 },

  {
    kind: "manualUse",
    days: 4,
    item: "grey",
    qty: 2,
    project: "P3",
    lot: "P3-L2",
    notes: "Remake of a chipped end panel.",
  },
  {
    kind: "manualUse",
    days: 14,
    item: "sealant",
    qty: 3,
    project: "P2",
    lot: "P2-L1",
    notes: "Site sealant for the splashback.",
  },
  {
    kind: "waste",
    days: 10,
    item: "oak",
    qty: 1,
    notes: "Damaged in transit.",
  },
  {
    kind: "waste",
    days: 16,
    item: "runner",
    qty: 2,
    notes: "Bent during unpacking.",
  },
  {
    kind: "waste",
    days: 7,
    item: "white",
    qty: 1,
    notes: "Mis-cut on the panel saw.",
  },
  {
    kind: "added",
    days: 11,
    item: "mdf",
    qty: 10,
    notes: "Stocktake adjustment.",
  },
  {
    kind: "added",
    days: 6,
    item: "leg",
    qty: 20,
    notes: "Returned from site, unused.",
  },
];

// ---------------------------------------------------------------------------
// Ordering and bookkeeping for the simulation
// ---------------------------------------------------------------------------

function simulateInventory() {
  const stock = new Map(ITEMS.map((i) => [i.key, i.open]));
  const mtoItems = new Map(); // "mto/item" -> state

  for (const mto of MTOS) {
    for (const [item, quantity, manual] of mto.lines) {
      mtoItems.set(`${mto.key}/${item}`, {
        id: `mock-mtoi-${mto.key}-${item}`,
        mto: mto.key,
        item,
        quantity,
        quantity_ordered: manual ?? 0,
        quantity_ordered_po: 0,
        quantity_used: 0,
        reservations: [],
      });
    }
  }
  const line = (mto, item) => {
    const found = mtoItems.get(`${mto}/${item}`);
    if (!found)
      throw new Error(`Seed data error: ${mto} has no line for "${item}"`);
    return found;
  };

  const transactions = [];
  const reservations = [];
  let txCounter = 0;
  const addTransaction = (row) =>
    transactions.push({
      id: `mock-st-${String(++txCounter).padStart(3, "0")}`,
      ...row,
    });

  // Creating a PO counts it against its MTO lines (cancelled ones give it back)
  for (const po of POS) {
    if (!po.mto || po.status === "CANCELLED") continue;
    for (const [item, qty] of po.lines)
      line(po.mto, item).quantity_ordered_po += qty;
  }

  const events = [];
  for (const po of POS) {
    if (!["PARTIALLY_RECEIVED", "FULLY_RECEIVED"].includes(po.status)) continue;
    // Check the declared status really matches what was received
    const allIn = po.lines.every(([, qty, , rec]) => rec >= qty);
    const expected = allIn ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";
    if (expected !== po.status) {
      throw new Error(
        `Seed data error: ${po.no} is ${po.status} but its lines say ${expected}`,
      );
    }
    for (const [item, , , rec] of po.lines) {
      if (rec > 0)
        events.push({ kind: "receive", days: po.received, po, item, qty: rec });
    }
  }
  events.push(...MOVEMENTS);

  // Oldest first; stable for ties, so movements keep their listed order
  events.sort((a, b) => b.days - a.days);

  const take = (item, qty, when) => {
    const next = stock.get(item) - qty;
    if (next < 0) {
      throw new Error(
        `Seed data error: "${item}" would go to ${next} (${when}). Raise its opening stock.`,
      );
    }
    stock.set(item, next);
  };

  let rsvCounter = 0;
  for (const e of events) {
    const at = daysAgo(e.days, "10:30");
    if (e.kind === "receive") {
      stock.set(e.item, stock.get(e.item) + e.qty);
      addTransaction({
        item: e.item,
        qty: e.qty,
        type: "ADDED",
        at,
        po: e.po.no,
        notes: `Received from PO ${e.po.no}`,
      });
    } else if (e.kind === "added") {
      stock.set(e.item, stock.get(e.item) + e.qty);
      addTransaction({
        item: e.item,
        qty: e.qty,
        type: "ADDED",
        at,
        notes: e.notes,
      });
    } else if (e.kind === "waste") {
      take(e.item, e.qty, `waste ${e.days}d ago`);
      addTransaction({
        item: e.item,
        qty: e.qty,
        type: "WASTED",
        at,
        notes: e.notes,
      });
    } else if (e.kind === "manualUse") {
      take(e.item, e.qty, `manual use ${e.days}d ago`);
      addTransaction({
        item: e.item,
        qty: e.qty,
        type: "USED",
        at,
        project: e.project,
        lot: e.lot,
        notes: e.notes,
      });
    } else if (e.kind === "reserve") {
      const l = line(e.mto, e.item);
      take(e.item, e.qty, `reserve ${e.days}d ago`);
      const row = {
        id: `mock-rsv-${String(++rsvCounter).padStart(2, "0")}`,
        item: e.item,
        mtoItem: l.id,
        quantity: e.qty,
        used_quantity: 0,
        user: e.user,
        at,
      };
      l.reservations.push(row);
      reservations.push(row);
    } else if (e.kind === "use") {
      const l = line(e.mto, e.item);
      if (l.quantity_used + e.qty > l.quantity) {
        throw new Error(
          `Seed data error: ${e.mto}/${e.item} used beyond its quantity`,
        );
      }
      l.quantity_used += e.qty;
      let remaining = e.qty;
      for (const r of [...l.reservations]) {
        if (remaining <= 0) break;
        const available = r.quantity - r.used_quantity;
        const fromReservation = Math.min(available, remaining);
        if (fromReservation >= available) {
          l.reservations.splice(l.reservations.indexOf(r), 1);
          reservations.splice(reservations.indexOf(r), 1);
        } else {
          r.used_quantity += fromReservation;
        }
        remaining -= fromReservation;
      }
      if (remaining > 0)
        take(e.item, remaining, `use ${e.mto}/${e.item} ${e.days}d ago`);
      addTransaction({
        item: e.item,
        qty: e.qty,
        type: "USED",
        at,
        mto: e.mto,
        notes: `Used from MTO ${e.mto}`,
      });
    }
  }

  // MTO status follows checkAndUpdateMTOStatus(); `closed` ones are CLOSED.
  const mtoMeta = new Map();
  for (const mto of MTOS) {
    const lines = [...mtoItems.values()].filter((l) => l.mto === mto.key);
    let allCovered = true;
    let anyCovered = false;
    for (const l of lines) {
      const reserved = l.reservations.reduce((s, r) => s + r.quantity, 0);
      const ordered =
        l.quantity_ordered_po > 0 ? l.quantity_ordered_po : l.quantity_ordered;
      if (reserved + ordered > 0) anyCovered = true;
      if (reserved + ordered < l.quantity) allCovered = false;
    }
    const covered = allCovered
      ? "FULLY_ORDERED"
      : anyCovered
        ? "PARTIALLY_ORDERED"
        : "DRAFT";
    mtoMeta.set(mto.key, {
      status: mto.closed ? "CLOSED" : covered,
      used_material_completed: lines.every(
        (l) => l.quantity_used >= l.quantity,
      ),
    });
  }

  return { stock, mtoItems, transactions, reservations, mtoMeta };
}

// ---------------------------------------------------------------------------
// Clean up
// ---------------------------------------------------------------------------

const MOCK_SLUGS = CLIENTS.map((c) => c.slug);
const MOCK_PROJECT_PREFIXES = MOCK_SLUGS.map((s) => `ikc-${s.toLowerCase()}-`);
const startsWithAny = (field, prefixes) => ({
  OR: prefixes.map((p) => ({ [field]: { startsWith: p } })),
});

async function cleanMockData() {
  log("Removing previous mock data…");

  const users = await prisma.users.findMany({
    where: { username: { startsWith: "mock." } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const projects = await prisma.project.findMany({
    where: startsWithAny("project_id", MOCK_PROJECT_PREFIXES),
    select: { project_id: true },
  });
  const projectIds = projects.map((p) => p.project_id);
  const suppliers = await prisma.supplier.findMany({
    where: { name: { in: SUPPLIERS.map((s) => s.name) } },
    select: { supplier_id: true },
  });
  const supplierIds = suppliers.map((s) => s.supplier_id);

  await prisma.clock_punch.deleteMany({
    where: {
      OR: [
        { employee_id: { startsWith: "MOCK-" } },
        { idempotency_key: { startsWith: "mock-seed-" } },
      ],
    },
  });
  await prisma.stock_transaction.deleteMany({
    where: {
      OR: [
        { id: { startsWith: "mock-" } },
        { item_id: { startsWith: "mock-" } },
      ],
    },
  });
  await prisma.purchase_order.deleteMany({
    where: {
      OR: [
        { order_no: { startsWith: "MOCK-PO-" } },
        { supplier_id: { in: supplierIds } },
      ],
    },
  });
  await prisma.materials_to_order.deleteMany({
    where: {
      OR: [{ id: { startsWith: "mock-" } }, { project_id: { in: projectIds } }],
    },
  });
  // The selection <-> current version link is circular, so break it first
  await prisma.material_selection.updateMany({
    where: {
      OR: [{ id: { startsWith: "mock-" } }, { project_id: { in: projectIds } }],
    },
    data: { current_version_id: null },
  });
  await prisma.material_selection.deleteMany({
    where: {
      OR: [{ id: { startsWith: "mock-" } }, { project_id: { in: projectIds } }],
    },
  });
  await prisma.quote.deleteMany({
    where: { quote_id: { startsWith: "Q-MOCK-" } },
  });
  await prisma.meeting.deleteMany({ where: { id: { startsWith: "mock-" } } });
  await prisma.todo.deleteMany({ where: { id: { startsWith: "mock-" } } });
  await prisma.item.deleteMany({ where: { item_id: { startsWith: "mock-" } } });
  await prisma.lot.deleteMany({ where: { project_id: { in: projectIds } } });
  await prisma.project.deleteMany({
    where: { project_id: { in: projectIds } },
  });
  await prisma.supplier.deleteMany({
    where: { supplier_id: { in: supplierIds } },
  });
  await prisma.client.deleteMany({
    where: { client_slug: { in: MOCK_SLUGS } },
  });
  await prisma.logs.deleteMany({ where: { id: { startsWith: "mock-" } } });
  await prisma.nfc_punch_tag.deleteMany({
    where: { id: { startsWith: "mock-" } },
  });
  await prisma.constants_config.deleteMany({
    where: { id: { startsWith: "mock-" } },
  });
  if (userIds.length)
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
  await prisma.employees.deleteMany({
    where: { employee_id: { startsWith: "MOCK-" } },
  });

  log("Previous mock data removed.");
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

const empId = (key) =>
  `MOCK-${String(EMPLOYEES.findIndex((e) => e.key === key) + 1).padStart(3, "0")}`;
const projectId = (client, n = 1) =>
  `ikc-${client.slug.toLowerCase()}-${String(n).padStart(4, "0")}`;
const lotId = (key) => `mock-lot-${key.toLowerCase()}`;

const ctx = { users: {}, employees: {}, clients: {}, suppliers: {}, logs: [] };

// Accepts a user key ("admin") or the key of the employee who owns the login ("hannah").
function userFor(key) {
  const direct = ctx.users[key];
  if (direct) return direct;
  const account = USERS.find((u) => u.employee === key);
  if (account && ctx.users[account.key]) return ctx.users[account.key];
  throw new Error(`Seed data error: no user for "${key}"`);
}

function addLog(
  userKey,
  entity_type,
  entity_id,
  action,
  description,
  days,
  time = "10:00",
) {
  ctx.logs.push({
    id: `mock-log-${String(ctx.logs.length + 1).padStart(3, "0")}`,
    user_id: userFor(userKey).id,
    entity_type,
    entity_id,
    action,
    description,
    createdAt: daysAgo(days, time),
  });
}

async function seedConfig() {
  let n = 0;
  for (const [category, values] of Object.entries(CONFIG)) {
    for (const value of values) {
      await prisma.constants_config.create({
        data: {
          id: `mock-cfg-${String(++n).padStart(3, "0")}`,
          category,
          value,
        },
      });
    }
  }
  log(`  ${n} config options`);
}

async function seedPeople() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  for (const e of EMPLOYEES) {
    const id = empId(e.key);
    const number = id.slice(-3);
    ctx.employees[e.key] = await prisma.employees.create({
      data: {
        employee_id: id,
        first_name: e.first_name,
        last_name: e.last_name,
        role: e.role,
        email: `${e.first_name}.${e.last_name}`.toLowerCase() + "@example.com",
        phone: e.phone,
        dob: new Date(e.dob),
        join_date: daysAgo(e.join_days),
        address: `${10 + Number(number)} Example Street, Adelaide SA 50${String(Number(number) + 10).padStart(2, "0")}`,
        emergency_contact_name: "Emergency Contact",
        emergency_contact_phone: "0491 570 000",
        bank_account_name: `${e.first_name} ${e.last_name}`,
        bank_account_number: String(10000000 + Number(number) * 1111111),
        bank_account_bsb: "062-000",
        supper_account_name: "AustralianSuper",
        supper_account_number: `AS-${70000000 + Number(number) * 13131}`,
        tfn_number: `000 000 ${String(Number(number)).padStart(3, "0")}`,
        education: e.education,
        availability: WEEKDAY_AVAILABILITY,
        notes: e.notes,
        is_active: !e.inactive,
      },
    });
  }

  for (const u of USERS) {
    const user = await prisma.users.create({
      data: {
        username: u.username,
        password: hash,
        user_type: u.user_type,
        is_active: true,
        employee_id: u.employee ? empId(u.employee) : null,
      },
    });
    ctx.users[u.key] = user;
    await prisma.module_access.create({
      data: { user_id: user.id, ...u.access },
    });

    // Notification preferences: office staff get most things, field staff a few.
    if (["master", "admin", "manager"].includes(u.key)) {
      await prisma.notification_config.create({
        data: {
          user_id: user.id,
          material_to_order: true,
          material_to_order_ordered: true,
          assign_installer: true,
          meeting: true,
          stage_updates: true,
          stage_quote_approve: true,
          stage_drafting: true,
          stage_cnc: true,
          stage_assembly: true,
          stage_delivery: true,
          stage_installation: true,
          stage_job_completion: true,
          stock_transactions: true,
          supplier_statements: u.key !== "manager",
        },
      });
    } else {
      await prisma.notification_config.create({
        data: {
          user_id: user.id,
          assign_installer: true,
          meeting: true,
          stage_updates: true,
          stage_installation: true,
        },
      });
    }
  }
  log(
    `  ${EMPLOYEES.length} employees, ${USERS.length} users (password: ${PASSWORD})`,
  );
}

async function seedClients() {
  for (const c of CLIENTS) {
    const client = await prisma.client.create({
      data: {
        client_name: c.name,
        client_slug: c.slug,
        client_type: c.type,
        client_address: c.address,
        client_phone: c.phone,
        client_email: c.email,
        client_website: c.website,
        client_notes: c.notes,
        is_deleted: !!c.deleted,
        contacts: {
          create: c.contacts.map(([first, last, role, method]) => ({
            first_name: first,
            last_name: last,
            role,
            email: `${first}.${last}`.toLowerCase() + "@example.com",
            phone: "0491 570 " + String(100 + Math.floor(Math.random() * 800)),
            preferred_contact_method: method,
          })),
        },
      },
    });
    ctx.clients[c.key] = client;
  }
  log(`  ${CLIENTS.length} clients`);
}

async function seedSuppliers() {
  for (const s of SUPPLIERS) {
    ctx.suppliers[s.key] = await prisma.supplier.create({
      data: {
        name: s.name,
        address: s.address,
        phone: s.phone,
        email: s.email,
        website: s.website,
        abn_number: s.abn,
        notes: s.notes,
        is_deleted: !!s.deleted,
        contacts: {
          create: s.contacts.map(([first, last, role]) => ({
            first_name: first,
            last_name: last,
            role,
            email: `${first}.${last}`.toLowerCase() + "@example.com",
            phone: s.phone,
            preferred_contact_method: "email",
          })),
        },
      },
    });
  }

  // Three months of statements for the main suppliers, oldest paid.
  const statementSuppliers = ["spanel", "ahub", "hhaus", "etape"];
  let count = 0;
  for (const [si, key] of statementSuppliers.entries()) {
    for (let m = 3; m >= 1; m--) {
      const month = dayjs().tz(TZ).subtract(m, "month");
      // One statement is left unpaid past its due date to exercise overdue payables
      const paid = (m > 1 || si === 0) && !(key === "hhaus" && m === 2);
      await prisma.supplier_statement.create({
        data: {
          supplier_id: ctx.suppliers[key].supplier_id,
          month_year: month.format("YYYY-MM"),
          amount: money(2400 + si * 970 + m * 413.35),
          payment_status: paid ? "PAID" : "PENDING",
          due_date: month.endOf("month").add(20, "day").toDate(),
          notes: paid ? "Paid by EFT." : "Awaiting approval.",
        },
      });
      count += 1;
    }
  }
  log(`  ${SUPPLIERS.length} suppliers, ${count} statements`);
}

async function seedProjects() {
  const lotMeta = [];
  const lotCount = { n: 0 };

  for (const p of PROJECTS) {
    const client = CLIENTS.find((c) => c.key === p.client);
    const pid = projectId(client);
    await prisma.project.create({
      data: {
        project_id: pid,
        name: p.name,
        client_id: ctx.clients[p.client].client_id,
        createdAt: daysAgo(-p.start),
      },
    });
    addLog(
      "manager",
      "project",
      pid,
      "CREATE",
      `Project created: ${p.name}`,
      -p.start,
    );

    for (const lot of p.lots) {
      lotCount.n += 1;
      const completed = lot.status === "COMPLETED";
      const currentIndex = completed
        ? STAGES.length
        : STAGES.indexOf(lot.progress);
      const na = new Set(lot.na ?? ["drafting revision"]);
      const installer = lot.installer ? ctx.employees[lot.installer] : null;
      const id = lotId(lot.key);

      await prisma.lot.create({
        data: {
          lot_id: id,
          project_id: pid,
          name: lot.name,
          status: lot.status ?? "ACTIVE",
          startDate: daysAgo(-lot.start),
          installationDueDate: daysAgo(-lot.due),
          notes: lot.notes,
          installer_id: installer?.employee_id ?? null,
          installer_notes: installer
            ? `Assigned to ${installer.first_name} ${installer.last_name}.`
            : null,
          createdAt: daysAgo(-lot.start),
        },
      });
      addLog(
        "manager",
        "lot",
        id,
        "CREATE",
        `Lot created: ${lot.name}`,
        -lot.start,
        "11:00",
      );
      if (installer)
        addLog(
          "manager",
          "lot",
          id,
          "ASSIGN",
          `Installer assigned: ${installer.first_name} ${installer.last_name}`,
          Math.min(-lot.start, 30),
          "11:30",
        );

      // Spread the finished stages over the time available, ending before today.
      const finished = STAGES.slice(0, currentIndex).filter((s) => !na.has(s));
      const budget = Math.max(-lot.start - 1, 1);
      const natural =
        finished.reduce((sum, s) => sum + STAGE_DAYS[STAGES.indexOf(s)], 0) ||
        1;
      const scale = Math.min(1, budget / natural);

      let cursor = -lot.start; // days ago
      for (const [index, name] of STAGES.entries()) {
        let status = "NOT_STARTED";
        let startDate = null;
        let endDate = null;
        if (na.has(name)) status = "NA";
        else if (index < currentIndex) {
          status = "DONE";
          const span = Math.max(1, Math.round(STAGE_DAYS[index] * scale));
          startDate = daysAgo(cursor);
          endDate = daysAgo(Math.max(cursor - span, 0));
          cursor = Math.max(cursor - span, 1);
        } else if (index === currentIndex) {
          status = lot.status === "CANCELLED" ? "NOT_STARTED" : "IN_PROGRESS";
          if (status === "IN_PROGRESS") {
            startDate = daysAgo(Math.max(cursor, 1));
            // Planned finish: a couple of lots have already missed theirs
            endDate = lot.overdueStage
              ? daysAgo(2)
              : daysAgo(-(2 + (((lot.start % 4) + 4) % 4)));
          }
        }

        const owners =
          status === "NA"
            ? []
            : (STAGE_OWNERS[name] ?? [])
                .map((o) => (o === "installer" ? lot.installer : o))
                .filter(Boolean);
        const stage = await prisma.stage.create({
          data: {
            lot_id: id,
            name,
            status,
            startDate,
            endDate,
            notes:
              status === "IN_PROGRESS" && lot.progress === "drafting"
                ? "Waiting on appliance specs."
                : null,
            assigned_to: {
              create: [...new Set(owners)].map((o) => ({
                employee_id: empId(o),
              })),
            },
          },
        });
        if (status === "DONE" && index % 3 === 0) {
          addLog(
            "manager",
            "stage",
            stage.stage_id,
            "STATUS_CHANGE",
            `${lot.name}: ${name} marked DONE`,
            Math.max(cursor, 1),
            "15:00",
          );
        }
      }

      for (const t of tabsFor(lot, currentIndex)) {
        await prisma.lot_tab.create({
          data: { lot_id: id, tab: t.tab, notes: t.notes },
        });
      }
      lotMeta.push({ key: lot.key, id, selection: lot.selection });
    }
  }
  log(
    `  ${PROJECTS.length} projects, ${lotCount.n} lots (with stages and tabs)`,
  );
  return lotMeta;
}

async function seedSelections(lotMeta) {
  let versions = 0;
  for (const [key, sel] of Object.entries(SELECTIONS)) {
    const lot = lotMeta.find((l) => l.selection === key);
    const project = PROJECTS.find((p) => p.lots.some((l) => l.key === lot.key));
    const pid = projectId(CLIENTS.find((c) => c.key === project.client));

    await prisma.quote.create({
      data: { id: `mock-quote-${key}`, quote_id: sel.quote },
    });
    const selection = await prisma.material_selection.create({
      data: {
        id: `mock-ms-${key}`,
        lot_id: lot.id,
        project_id: pid,
        quote_id: sel.quote,
        createdBy_id: userFor(sel.by).id,
      },
    });
    await prisma.lot.update({
      where: { lot_id: lot.id },
      data: { material_selection_id: selection.id },
    });

    let currentId = null;
    for (const [i, v] of sel.versions.entries()) {
      const isCurrent = i === sel.versions.length - 1;
      const version = await prisma.material_selection_versions.create({
        data: {
          material_selection_id: selection.id,
          version_number: i + 1,
          is_current: isCurrent,
          quote_id: sel.quote,
          notes: v.notes,
          ceiling_height: v.heights.ceiling,
          bulkhead_height: v.heights.bulkhead,
          kicker_height: v.heights.kicker,
          cabinetry_height: v.heights.cabinetry,
          createdAt: daysAgo(30 - i * 10),
          areas: {
            create: v.areas.map((a, ai) => ({
              area_name: a.name,
              area_instance_id: ai + 1,
              bed_option: a.bed_option ?? null,
              notes: a.notes,
              items: {
                create: a.items.map((it) => ({
                  name: it.name,
                  category: it.category,
                  is_applicable: it.applicable,
                  item_notes: it.notes,
                })),
              },
            })),
          },
        },
      });
      versions += 1;
      if (isCurrent) currentId = version.id;
    }
    await prisma.material_selection.update({
      where: { id: selection.id },
      data: { current_version_id: currentId },
    });
    addLog(
      sel.by,
      "material_selection",
      selection.id,
      "CREATE",
      `Material selection created for ${lot.key} (${sel.quote})`,
      30,
      "13:00",
    );
  }
  log(
    `  ${Object.keys(SELECTIONS).length} material selections, ${versions} versions`,
  );
}

async function seedInventory(sim) {
  for (const i of ITEMS) {
    const id = `mock-item-${i.key}`;
    await prisma.item.create({
      data: {
        item_id: id,
        category: i.category,
        description: i.description,
        quantity: sim.stock.get(i.key),
        minimum_stock: i.min,
        measurement_unit: i.unit,
        [i.category === "EDGING_TAPE"
          ? "edging_tape"
          : i.category.toLowerCase()]: { create: i.detail },
      },
    });
    for (const [sup, ref, price] of i.sup) {
      await prisma.item_suppliers.create({
        data: {
          item_id: id,
          supplier_id: ctx.suppliers[sup].supplier_id,
          supplier_reference: ref,
          price,
          supplier_product_link: `https://example.com/products/${ref.toLowerCase()}`,
        },
      });
    }
  }
  const low = ITEMS.filter((i) => sim.stock.get(i.key) < i.min);
  log(
    `  ${ITEMS.length} items (${low.length} below minimum stock: ${low.map((i) => i.key).join(", ")})`,
  );
}

async function seedProcurement(sim) {
  for (const m of MTOS) {
    const project = PROJECTS.find((p) => p.key === m.project);
    const pid = projectId(CLIENTS.find((c) => c.key === project.client));
    const meta = sim.mtoMeta.get(m.key);
    await prisma.materials_to_order.create({
      data: {
        id: `mock-mto-${m.key}`,
        project_id: pid,
        status: meta.status,
        notes: m.notes,
        createdBy_id: userFor(m.by).id,
        used_material_completed: meta.used_material_completed,
        createdAt: daysAgo(m.days),
        items: {
          create: m.lines.map(([item]) => {
            const l = sim.mtoItems.get(`${m.key}/${item}`);
            return {
              id: l.id,
              item_id: `mock-item-${item}`,
              quantity: l.quantity,
              quantity_ordered: l.quantity_ordered,
              quantity_ordered_po: l.quantity_ordered_po,
              quantity_used: l.quantity_used,
              ordered_by_id: l.quantity_ordered > 0 ? userFor(m.by).id : null,
            };
          }),
        },
      },
    });
    for (const lotKey of m.lots) {
      await prisma.lot.update({
        where: { lot_id: lotId(lotKey) },
        data: { materials_to_orders_id: `mock-mto-${m.key}` },
      });
    }
    addLog(
      m.by,
      "materials_to_order",
      `mock-mto-${m.key}`,
      "CREATE",
      `Materials to order created for ${project.name}`,
      m.days,
      "09:30",
    );
  }

  for (const po of POS) {
    const lines = po.lines.map(([item, qty, price, received]) => {
      const total = money(qty * price);
      return {
        item,
        qty,
        price,
        received,
        total,
        gst: money(total * GST_RATE),
      };
    });
    const grand = lines.reduce((s, l) => s + l.total + l.gst, 0);
    const ordered = po.status !== "DRAFT";
    await prisma.purchase_order.create({
      data: {
        id: `mock-po-${po.no.slice(-4)}`,
        order_no: po.no,
        supplier_id: ctx.suppliers[po.supplier].supplier_id,
        mto_id: po.mto ? `mock-mto-${po.mto}` : null,
        status: po.status,
        notes: po.notes,
        orderedBy_id: userFor(po.by).id,
        ordered_at: ordered ? daysAgo(po.days, "09:15") : null,
        total_amount: money(grand),
        delivery_charge: po.delivery || null,
        invoice_date: po.received ? daysAgo(po.received - 1) : null,
        expected_delivery_date:
          po.expect !== undefined ? daysAgo(-po.expect) : null,
        createdAt: daysAgo(po.days, "09:00"),
        items: {
          create: lines.map((l, idx) => ({
            id: `mock-poi-${po.no.slice(-4)}-${idx + 1}`,
            item_id: `mock-item-${l.item}`,
            mto_item_id: po.mto ? `mock-mtoi-${po.mto}-${l.item}` : null,
            quantity: l.qty,
            quantity_received: l.received,
            unit_price: l.price,
            total_amount: l.total,
            gst: l.gst,
          })),
        },
      },
    });
    addLog(
      po.by,
      "purchase_order",
      `mock-po-${po.no.slice(-4)}`,
      "CREATE",
      `Purchase order created: ${po.no}`,
      po.days,
      "09:20",
    );
    if (po.status === "CANCELLED")
      addLog(
        po.by,
        "purchase_order",
        `mock-po-${po.no.slice(-4)}`,
        "STATUS_CHANGE",
        `Purchase order ${po.no} cancelled`,
        po.days - 1,
        "14:00",
      );
  }

  for (const t of sim.transactions) {
    await prisma.stock_transaction.create({
      data: {
        id: t.id,
        item_id: `mock-item-${t.item}`,
        quantity: t.qty,
        type: t.type,
        notes: t.notes,
        purchase_order_id: t.po ? `mock-po-${t.po.slice(-4)}` : null,
        materials_to_order_id: t.mto ? `mock-mto-${t.mto}` : null,
        project_id: t.project
          ? projectId(
              CLIENTS.find(
                (c) =>
                  c.key === PROJECTS.find((p) => p.key === t.project).client,
              ),
            )
          : null,
        lot_id: t.lot ? lotId(t.lot) : null,
        createdAt: t.at,
      },
    });
  }
  for (const r of sim.reservations) {
    await prisma.reserve_item_stock.create({
      data: {
        id: r.id,
        item_id: `mock-item-${r.item}`,
        mto_id: r.mtoItem,
        quantity: r.quantity,
        used_quantity: r.used_quantity,
        user_id: userFor(r.user).id,
        createdAt: r.at,
      },
    });
  }
  log(
    `  ${MTOS.length} materials-to-order, ${POS.length} purchase orders, ${sim.transactions.length} stock transactions, ${sim.reservations.length} reservations`,
  );
}

async function seedPunches() {
  const rand = mulberry32(20261002);
  const rnd = (min, max) => Math.floor(min + rand() * (max - min + 1));
  const hhmm = (mins) =>
    `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

  const tag = await prisma.nfc_punch_tag.create({
    data: {
      id: "mock-nfc-1",
      name: "Workshop door",
      location: "Main workshop entrance",
      token_hash: createHash("sha256").update("mock-nfc-token-1").digest("hex"),
      is_active: true,
    },
  });
  await prisma.nfc_punch_tag.create({
    data: {
      id: "mock-nfc-2",
      name: "Spare tag",
      location: "Unassigned (not yet provisioned)",
      is_active: false,
    },
  });

  const staff = ["dale", "marcus", "tran", "priya", "callum", "sophie"];
  const dates = recentWeekdays(14);
  const now = dayjs();
  let total = 0;

  for (const who of staff) {
    const user = userFor(who);
    const employee = ctx.employees[who];
    for (const [dayIdx, date] of dates.entries()) {
      const special =
        (who === "tran" && dayIdx === 9) || (who === "callum" && dayIdx === 8);
      if (dayIdx > 0 && !special && rand() < 0.06) continue; // a day off now and then

      const start = rnd(6 * 60 + 45, 7 * 60 + 20);
      const breakIn = rnd(11 * 60 + 40, 12 * 60 + 25);
      const breakOut = breakIn + rnd(28, 40);
      const end = rnd(15 * 60, 16 * 60 + 5);
      const shift = [
        ["CLOCK_IN", start],
        ["BREAK_IN", breakIn],
        ["BREAK_OUT", breakOut],
        ["CLOCK_OUT", end],
      ];

      // Review state by age, with one rejected and one manually entered shift
      let review = "PENDING";
      let note = null;
      let type = who === "dale" ? "NFC" : "EMPLOYEE";
      if (dayIdx >= 5) {
        review = "APPROVED";
        note = "Approved in the weekly payroll check.";
      }
      if (who === "tran" && dayIdx === 9) {
        review = "REJECTED";
        note =
          "Punched at the wrong time, please confirm hours with the office.";
      }
      if (who === "callum" && dayIdx === 8) {
        review = "APPROVED";
        type = "MANUAL";
        note = "Entered manually — forgot to punch out.";
      }

      for (const [i, [action, minutes]] of shift.entries()) {
        const punchedAt = dayjs.tz(`${date} ${hhmm(minutes)}`, TZ);
        if (punchedAt.isAfter(now)) continue; // never in the future
        const reviewed = review !== "PENDING";
        await prisma.clock_punch.create({
          data: {
            employee_id: employee.employee_id,
            user_id: user.id,
            action,
            punch_type: type,
            punched_at: punchedAt.toDate(),
            nfc_tag_id: type === "NFC" ? tag.id : null,
            review_status: review,
            reviewed_by_id: reviewed ? ctx.users.admin.id : null,
            reviewed_at: reviewed
              ? dayjs.tz(`${date} 17:00`, TZ).toDate()
              : null,
            review_notes: reviewed ? note : null,
            // Marked as already sent so the break-reminder cron stays quiet
            break_warning_sent_at:
              action === "BREAK_IN" ? punchedAt.toDate() : null,
            break_over_sent_at:
              action === "BREAK_IN" ? punchedAt.toDate() : null,
            idempotency_key: `mock-seed-${employee.employee_id}-${date}-${i}`,
          },
        });
        total += 1;
      }
    }
  }
  log(`  ${total} clock punches, 2 NFC tags`);
}

async function seedCalendarAndTodos() {
  // Reminder flags are pre-set so the reminder cron never messages these
  // (fake) phone numbers.
  const meetings = [
    {
      id: "w1",
      title: "Lakeside Stage 2 — site walk",
      start: [-1, "10:00"],
      end: [-1, "11:00"],
      notes: "Walk Lots 14 to 16 with the site supervisor.",
      people: ["manager", "priya", "sophie"],
      lots: ["P1-L1", "P1-L2", "P1-L3"],
    },
    {
      id: "w2",
      title: "Harcourt kitchen — install handover",
      start: [-3, "13:30"],
      end: [-3, "14:30"],
      notes: "Final walkthrough with the homeowner.",
      people: ["manager", "callum"],
      lots: ["P2-L1"],
    },
    {
      id: "w3",
      title: "Weekly production meeting",
      start: [0, "15:45"],
      end: [0, "16:30"],
      notes: "Review the cut list and the delivery runs.",
      people: ["manager", "admin", "marcus", "tran", "sophie"],
      lots: [],
    },
    {
      id: "w4",
      title: "Ocean View — material review",
      start: [4, "09:00"],
      end: [4, "10:00"],
      notes: "Confirm finishes for apartments 301 and 302.",
      people: ["manager", "sophie", "admin"],
      lots: ["P4-L1", "P4-L2"],
    },
    {
      id: "w5",
      title: "Townhouse B — delivery planning",
      start: [8, "14:00"],
      end: [8, "14:45"],
      notes: null,
      people: ["manager", "priya"],
      lots: ["P3-L2"],
    },
    {
      id: "w6",
      title: "Supplier review — Southern Panel",
      start: [0, "11:00"],
      end: [0, "11:30"],
      notes: "Discuss lead times and the volume discount.",
      people: ["admin", "manager"],
      lots: [],
      past: true,
    },
  ];
  for (const m of meetings) {
    await prisma.meeting.create({
      data: {
        id: `mock-meeting-${m.id}`,
        title: m.title,
        notes: m.notes,
        date_time: daysAgo(-m.start[0], m.start[1]),
        date_time_end: daysAgo(-m.end[0], m.end[1]),
        remainder: "1 hour before",
        remainder_1h_sent: true,
        remainder_1d_sent: true,
        participants: {
          connect: m.people.map((p) => ({ id: ctx.users[p].id })),
        },
        lots: { connect: m.lots.map((l) => ({ lot_id: lotId(l) })) },
      },
    });
  }

  const todos = [
    {
      id: "t1",
      title: "Confirm Lot 16 appliance schedule with Lakeside",
      notes: "Fridge recess moved — need the new model.",
      due: 2,
      by: "manager",
      tag: ["sophie"],
    },
    {
      id: "t2",
      title: "Chase Hardware Hub about back-ordered runners",
      notes: "PO MOCK-PO-0002.",
      due: -1,
      by: "admin",
      tag: ["admin", "manager"],
    },
    {
      id: "t3",
      title: "Book Townhouse B delivery truck",
      notes: null,
      due: 6,
      by: "manager",
      tag: ["callum"],
    },
    {
      id: "t4",
      title: "Order Light Grey edging",
      notes: "Out of stock.",
      due: 1,
      by: "admin",
      tag: [],
    },
    {
      id: "t5",
      title: "Send Harcourt final invoice",
      notes: null,
      due: 4,
      by: "admin",
      tag: ["admin"],
    },
    {
      id: "t6",
      title: "Service the CNC dust extractor",
      notes: "Filters are overdue.",
      due: -5,
      by: "manager",
      tag: ["marcus"],
      done: { by: "marcus", daysAgo: 3 },
    },
    {
      id: "t7",
      title: "Reconcile August supplier statements",
      notes: null,
      due: -10,
      by: "admin",
      tag: ["admin"],
      done: { by: "admin", daysAgo: 8 },
    },
    {
      id: "t8",
      title: "Renew workshop insurance",
      notes: "Policy ends next month.",
      due: 20,
      by: "master",
      tag: ["master"],
    },
    {
      id: "t9",
      title: "Old task that was cancelled",
      notes: null,
      due: null,
      by: "manager",
      tag: [],
      deleted: true,
    },
  ];
  for (const t of todos) {
    await prisma.todo.create({
      data: {
        id: `mock-todo-${t.id}`,
        title: t.title,
        notes: t.notes,
        due_date: t.due === null ? null : daysAgo(-t.due, "17:00"),
        created_by_id: ctx.users[t.by].id,
        is_completed: !!t.done,
        completed_at: t.done ? daysAgo(t.done.daysAgo, "16:00") : null,
        completed_by_id: t.done ? ctx.users[t.done.by].id : null,
        is_deleted: !!t.deleted,
        tagged_users: { connect: t.tag.map((u) => ({ id: ctx.users[u].id })) },
      },
    });
  }
  log(`  ${meetings.length} meetings, ${todos.length} todos`);
}

async function seedLogs() {
  // A handful of entries for the remaining entity types, then flush them all.
  addLog(
    "admin",
    "client",
    ctx.clients.oceanview.client_id,
    "CREATE",
    "Client created: Ocean View Apartments Pty Ltd",
    95,
    "09:00",
  );
  addLog(
    "admin",
    "client",
    ctx.clients.redgum.client_id,
    "DELETE",
    "Client removed: Redgum Constructions",
    40,
    "16:00",
  );
  addLog(
    "admin",
    "supplier",
    ctx.suppliers.old.supplier_id,
    "DELETE",
    "Supplier removed: Old Timber Merchants",
    60,
    "16:10",
  );
  addLog(
    "manager",
    "stock_transaction",
    "mock-st-001",
    "OTHER",
    "Stock tally completed by Dale Whitfield",
    11,
    "17:00",
  );
  addLog(
    "master",
    "module_access",
    ctx.users.manager.id,
    "UPDATE",
    "Module access updated for mock.manager",
    30,
    "08:30",
  );
  addLog(
    "master",
    "user",
    ctx.users.sophie.id,
    "CREATE",
    "User created: mock.sophie",
    120,
    "08:00",
  );
  addLog(
    "sophie",
    "lot_file",
    lotId("P1-L1"),
    "UPLOAD",
    "Uploaded Rev C architectural drawings",
    40,
    "14:20",
  );
  addLog(
    "priya",
    "lot_file",
    lotId("P4-L3"),
    "UPLOAD",
    "Uploaded delivery photos",
    6,
    "10:45",
  );

  await prisma.logs.createMany({
    data: ctx.logs.sort((a, b) => a.createdAt - b.createdAt),
  });
  log(`  ${ctx.logs.length} audit log entries`);
}

// ---------------------------------------------------------------------------

async function main() {
  try {
    await cleanMockData();
  } catch (error) {
    if (error?.code === "P2003" || error?.code === "P2014") {
      throw new Error(
        "Could not remove the old mock data because other records now reference it " +
          "(for example a purchase order or punch created in the app against a mock " +
          "supplier or user). Delete those in the app, then re-run.",
        { cause: error },
      );
    }
    throw error;
  }
  if (cleanOnly) return;

  log("Seeding mock data…");
  const sim = simulateInventory();

  await seedConfig();
  await seedPeople();
  await seedClients();
  await seedSuppliers();
  await seedInventory(sim);
  const lotMeta = await seedProjects();
  await seedSelections(lotMeta);
  await seedProcurement(sim);
  await seedPunches();
  await seedCalendarAndTodos();
  await seedLogs();

  log("\nDone. Every account uses the password below:");
  log(`  password: ${PASSWORD}`);
  for (const u of USERS) log(`  ${u.username.padEnd(14)} (${u.user_type})`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
