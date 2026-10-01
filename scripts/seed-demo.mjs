/**
 * Demo data seeder — creates a small, realistic dataset for screenshots/video.
 *
 * Creates:
 *   1 master admin user
 *   2 employees (each with their own login)
 *   5-6 clock punches per employee (valid CLOCK_IN -> BREAK -> CLOCK_OUT sequences)
 *   3 clients + 3 projects
 *   1-2 lots per project, each with stages, assignees and a couple of tabs
 *
 * Usage:
 *   node scripts/seed-demo.mjs           # create / update demo data
 *   node scripts/seed-demo.mjs --reset   # remove previously seeded demo data, then re-seed
 *   node scripts/seed-demo.mjs --reset --only-clean   # remove demo data and stop
 *
 * Everything it creates is tagged (employee ids start with DEMO-, punches carry a
 * "demo-seed-" idempotency key, clients/projects are tracked by slug), so --reset
 * only ever touches rows this script made. Re-running without --reset is safe:
 * records are upserted, not duplicated.
 */

import "dotenv/config";
import { createRequire } from "node:module";

import bcrypt from "bcrypt";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const require = createRequire(import.meta.url);
const { PrismaClient } = require("../generated/prisma/index.js");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

const TIME_ZONE = "Australia/Adelaide";
const DEMO_TAG = "demo-seed";
const EMPLOYEE_ID_PREFIX = "DEMO-";

// ---------------------------------------------------------------------------
// What gets created — tweak these before running if you want different names.
// ---------------------------------------------------------------------------

const MASTER_ADMIN = {
  username: "demo.master",
  password: "Demo@1234",
  user_type: "master-admin",
};

const EMPLOYEES = [
  {
    employee_id: `${EMPLOYEE_ID_PREFIX}001`,
    first_name: "Marcus",
    last_name: "Feldman",
    role: "Cabinet Maker",
    email: "marcus.feldman@example.com",
    phone: "0412 345 678",
    phone_secondary: "0412 345 679",
    dob: "1989-04-17",
    join_date: "2021-02-01",
    address: "14 Fullarton Road, Norwood SA 5067",
    emergency_contact_name: "Dana Feldman",
    emergency_contact_phone: "0413 111 222",
    bank_account_name: "Marcus Feldman",
    bank_account_number: "123456789",
    bank_account_bsb: "065-000",
    supper_account_name: "AustralianSuper",
    supper_account_number: "AS-88213004",
    tfn_number: "123 456 789",
    education: "Cert III in Cabinet Making",
    notes: "Lead on CNC and assembly. Demo record.",
    user: {
      username: "demo.marcus",
      password: "Demo@1234",
      user_type: "employee",
    },
  },
  {
    employee_id: `${EMPLOYEE_ID_PREFIX}002`,
    first_name: "Priya",
    last_name: "Raman",
    role: "Installer",
    email: "priya.raman@example.com",
    phone: "0422 987 654",
    phone_secondary: null,
    dob: "1993-11-02",
    join_date: "2022-08-15",
    address: "3 Marion Street, Mile End SA 5031",
    emergency_contact_name: "Arjun Raman",
    emergency_contact_phone: "0423 555 909",
    bank_account_name: "Priya Raman",
    bank_account_number: "987654321",
    bank_account_bsb: "015-220",
    supper_account_name: "Hostplus",
    supper_account_number: "HP-40921188",
    tfn_number: "987 654 321",
    education: "Cert IV in Building & Construction",
    notes: "Runs site measurements and installs. Demo record.",
    user: {
      username: "demo.priya",
      password: "Demo@1234",
      user_type: "employee",
    },
  },
];

const WEEKDAY_AVAILABILITY = {
  monday: { start: "07:00", end: "15:30" },
  tuesday: { start: "07:00", end: "15:30" },
  wednesday: { start: "07:00", end: "15:30" },
  thursday: { start: "07:00", end: "15:30" },
  friday: { start: "07:00", end: "14:00" },
  saturday: { start: "", end: "" },
  sunday: { start: "", end: "" },
};

const CLIENTS = [
  {
    key: "bettio",
    client_name: "Bettio Construction",
    client_slug: "BTTO",
    client_type: "builder",
    client_address: "72 Grand Junction Road, Rosewater SA 5013",
    client_phone: "08 8447 1200",
    client_email: "projects@bettio.example.com",
    client_website: "https://bettio.example.com",
    client_notes:
      "Repeat builder client — 4 to 6 kitchens a year. Demo record.",
    contact: {
      first_name: "Elena",
      last_name: "Bettio",
      role: "Project Manager",
      email: "elena@bettio.example.com",
      phone: "0407 220 118",
      preferred_contact_method: "email",
    },
  },
  {
    key: "harper",
    client_name: "Harper Residence",
    client_slug: "HRPR",
    client_type: "private",
    client_address: "26 Kensington Road, Norwood SA 5067",
    client_phone: "0408 776 331",
    client_email: "j.harper@example.com",
    client_website: null,
    client_notes:
      "Private renovation, homeowner is on site most days. Demo record.",
    contact: {
      first_name: "Jordan",
      last_name: "Harper",
      role: "Homeowner",
      email: "j.harper@example.com",
      phone: "0408 776 331",
      preferred_contact_method: "phone",
    },
  },
  {
    key: "northgate",
    client_name: "Northgate Developments",
    client_slug: "NRTH",
    client_type: "builder",
    client_address: "10 Peachey Road, Davoren Park SA 5113",
    client_phone: "08 8255 4400",
    client_email: "builds@northgate.example.com",
    client_website: "https://northgate.example.com",
    client_notes: "Townhouse developer, multi-lot packages. Demo record.",
    contact: {
      first_name: "Tomas",
      last_name: "Kraft",
      role: "Site Supervisor",
      email: "tomas@northgate.example.com",
      phone: "0410 448 902",
      preferred_contact_method: "phone",
    },
  },
];

// Lot names + the stage board each lot should show.
const PROJECTS = [
  {
    clientKey: "bettio",
    name: "Rosewater Display Homes",
    startOffsetDays: -45,
    lots: [
      {
        suffix: "lot 1",
        name: "Bettio — 12 Marlow Court",
        installDueOffsetDays: 21,
        notes: "Kitchen, butler's pantry and laundry. Stone tops by others.",
        installerIndex: 1,
        stages: [
          {
            name: "quotation",
            status: "DONE",
            assignees: [0],
            startOffset: -45,
            endOffset: -41,
          },
          {
            name: "quote approval",
            status: "DONE",
            assignees: [0],
            startOffset: -41,
            endOffset: -38,
          },
          {
            name: "drafting",
            status: "DONE",
            assignees: [0],
            startOffset: -38,
            endOffset: -30,
          },
          {
            name: "site measurements",
            status: "DONE",
            assignees: [1],
            startOffset: -29,
            endOffset: -28,
          },
          {
            name: "cnc",
            status: "IN_PROGRESS",
            assignees: [0],
            startOffset: -5,
            endOffset: null,
          },
          {
            name: "assembly",
            status: "NOT_STARTED",
            assignees: [0],
            startOffset: null,
            endOffset: null,
          },
          {
            name: "installation",
            status: "NOT_STARTED",
            assignees: [1],
            startOffset: null,
            endOffset: null,
          },
        ],
        tabs: [
          {
            tab: "ARCHITECTURE_DRAWINGS",
            notes: "Rev C drawings received from the builder.",
          },
          {
            tab: "SITE_MEASUREMENTS",
            notes:
              "Measured on site — wall out of square 8mm at the pantry return.",
          },
        ],
      },
      {
        suffix: "lot 2",
        name: "Bettio — 14 Marlow Court",
        installDueOffsetDays: 35,
        notes: "Mirror image of lot 1 with a different door finish.",
        installerIndex: 1,
        stages: [
          {
            name: "quotation",
            status: "DONE",
            assignees: [0],
            startOffset: -44,
            endOffset: -40,
          },
          {
            name: "quote approval",
            status: "DONE",
            assignees: [0],
            startOffset: -40,
            endOffset: -36,
          },
          {
            name: "drafting",
            status: "IN_PROGRESS",
            assignees: [0],
            startOffset: -12,
            endOffset: null,
          },
          {
            name: "site measurements",
            status: "NOT_STARTED",
            assignees: [1],
            startOffset: null,
            endOffset: null,
          },
          {
            name: "cnc",
            status: "NOT_STARTED",
            assignees: [0],
            startOffset: null,
            endOffset: null,
          },
        ],
        tabs: [
          {
            tab: "ARCHITECTURE_DRAWINGS",
            notes: "Awaiting the updated appliance schedule.",
          },
        ],
      },
    ],
  },
  {
    clientKey: "harper",
    name: "Harper Kitchen Renovation",
    startOffsetDays: -20,
    lots: [
      {
        suffix: "lot 1",
        name: "Harper — Main Kitchen",
        installDueOffsetDays: 14,
        notes:
          "Full strip-out and refit. Client selected matte black hardware.",
        installerIndex: 1,
        stages: [
          {
            name: "quotation",
            status: "DONE",
            assignees: [0],
            startOffset: -20,
            endOffset: -18,
          },
          {
            name: "quote approval",
            status: "DONE",
            assignees: [0],
            startOffset: -18,
            endOffset: -16,
          },
          {
            name: "material appliances selection",
            status: "DONE",
            assignees: [1],
            startOffset: -16,
            endOffset: -12,
          },
          {
            name: "drafting",
            status: "DONE",
            assignees: [0],
            startOffset: -12,
            endOffset: -8,
          },
          {
            name: "final design approval",
            status: "IN_PROGRESS",
            assignees: [0],
            startOffset: -3,
            endOffset: null,
          },
          {
            name: "material order",
            status: "NOT_STARTED",
            assignees: [0],
            startOffset: null,
            endOffset: null,
          },
          {
            name: "installation",
            status: "NOT_STARTED",
            assignees: [1],
            startOffset: null,
            endOffset: null,
          },
        ],
        tabs: [
          {
            tab: "MATERIAL_SELECTION",
            notes: "Polytec Nordic Oak carcasses, matte black handles.",
          },
          {
            tab: "CHANGES_TO_DO",
            notes: "Client asked to swap the bin drawer to the sink run.",
          },
        ],
      },
    ],
  },
  {
    clientKey: "northgate",
    name: "Davoren Park Townhouses",
    startOffsetDays: -70,
    lots: [
      {
        suffix: "lot 1",
        name: "Northgate — Townhouse A",
        installDueOffsetDays: -6,
        notes: "Completed and handed over. Kept for the maintenance record.",
        installerIndex: 1,
        status: "COMPLETED",
        stages: [
          {
            name: "quotation",
            status: "DONE",
            assignees: [0],
            startOffset: -70,
            endOffset: -66,
          },
          {
            name: "drafting",
            status: "DONE",
            assignees: [0],
            startOffset: -66,
            endOffset: -58,
          },
          {
            name: "cnc",
            status: "DONE",
            assignees: [0],
            startOffset: -30,
            endOffset: -26,
          },
          {
            name: "assembly",
            status: "DONE",
            assignees: [0],
            startOffset: -26,
            endOffset: -20,
          },
          {
            name: "delivery",
            status: "DONE",
            assignees: [1],
            startOffset: -12,
            endOffset: -11,
          },
          {
            name: "installation",
            status: "DONE",
            assignees: [1],
            startOffset: -10,
            endOffset: -7,
          },
          {
            name: "job completion",
            status: "DONE",
            assignees: [1],
            startOffset: -7,
            endOffset: -6,
          },
        ],
        tabs: [
          {
            tab: "INSTALLATION_PHOTOS",
            notes: "Handover pack sent to the builder.",
          },
          {
            tab: "FINISHED_SITE_PHOTOS",
            notes: "Photos taken at practical completion.",
          },
        ],
      },
      {
        suffix: "lot 2",
        name: "Northgate — Townhouse B",
        installDueOffsetDays: 28,
        notes: "Same package as Townhouse A, delayed by the site slab pour.",
        installerIndex: 1,
        stages: [
          {
            name: "quotation",
            status: "DONE",
            assignees: [0],
            startOffset: -68,
            endOffset: -64,
          },
          {
            name: "drafting",
            status: "DONE",
            assignees: [0],
            startOffset: -64,
            endOffset: -56,
          },
          {
            name: "machining out",
            status: "IN_PROGRESS",
            assignees: [0],
            startOffset: -2,
            endOffset: null,
          },
          {
            name: "assembly",
            status: "NOT_STARTED",
            assignees: [0],
            startOffset: null,
            endOffset: null,
          },
          {
            name: "delivery",
            status: "NOT_STARTED",
            assignees: [1],
            startOffset: null,
            endOffset: null,
          },
          {
            name: "installation",
            status: "NA",
            assignees: [],
            startOffset: null,
            endOffset: null,
          },
        ],
        tabs: [
          {
            tab: "CABINETRY_DRAWINGS",
            notes: "Shop drawings signed off, cut list released.",
          },
        ],
      },
    ],
  },
];

// Punch days per employee, relative to the most recent weekdays.
// Day 0 is today; the rest walk back over weekdays only.
const PUNCH_PLANS = [
  {
    // Marcus: an approved full shift, plus today's shift with him still on break.
    employeeIndex: 0,
    days: [
      {
        weekdaysAgo: 2,
        review_status: "APPROVED",
        punches: [
          { action: "CLOCK_IN", time: "07:02" },
          { action: "BREAK_IN", time: "11:58" },
          { action: "BREAK_OUT", time: "12:31" },
          { action: "CLOCK_OUT", time: "15:34" },
        ],
      },
      {
        weekdaysAgo: 0,
        review_status: "PENDING",
        punches: [
          { action: "CLOCK_IN", time: "06:58" },
          { action: "BREAK_IN", time: "12:04" },
        ],
      },
    ],
  },
  {
    // Priya: a pending full shift to review, plus today's clock in.
    employeeIndex: 1,
    days: [
      {
        weekdaysAgo: 1,
        review_status: "PENDING",
        punches: [
          { action: "CLOCK_IN", time: "07:15" },
          { action: "BREAK_IN", time: "12:10" },
          { action: "BREAK_OUT", time: "12:45" },
          { action: "CLOCK_OUT", time: "15:20" },
        ],
      },
      {
        weekdaysAgo: 0,
        review_status: "PENDING",
        punches: [{ action: "CLOCK_IN", time: "07:09" }],
      },
    ],
  },
];

const MASTER_MODULE_ACCESS = {
  all_clients: true,
  add_clients: true,
  client_details: true,
  dashboard: true,
  delete_media: true,
  all_employees: true,
  add_employees: true,
  employee_details: true,
  all_projects: true,
  add_projects: true,
  project_details: true,
  all_suppliers: true,
  add_suppliers: true,
  supplier_details: true,
  all_items: true,
  add_items: true,
  item_details: true,
  logs: true,
  lotatglance: true,
  materialstoorder: true,
  purchaseorder: true,
  statements: true,
  site_photos: true,
  config: true,
  site_measurements: true,
  usedmaterial: true,
  calendar: true,
  add_clock_punch: true,
  clock_punch_details: true,
  all_clock_punches: true,
};

const EMPLOYEE_MODULE_ACCESS = {
  dashboard: true,
  all_projects: true,
  project_details: true,
  lotatglance: true,
  calendar: true,
  site_photos: true,
  site_measurements: true,
  add_clock_punch: true,
  clock_punch_details: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const shouldReset = args.has("--reset");
const onlyClean = args.has("--only-clean");

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? 3306),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

const log = (message) => console.log(message);

function dayOffset(days) {
  return dayjs().add(days, "day").toDate();
}

// Walks back over weekdays only, so punches never land on a weekend.
function weekdayAgo(count) {
  let cursor = dayjs().tz(TIME_ZONE);
  while (cursor.day() === 0 || cursor.day() === 6)
    cursor = cursor.subtract(1, "day");
  let remaining = count;
  while (remaining > 0) {
    cursor = cursor.subtract(1, "day");
    if (cursor.day() !== 0 && cursor.day() !== 6) remaining -= 1;
  }
  return cursor.format("YYYY-MM-DD");
}

function adelaideInstant(dateString, timeString) {
  return dayjs.tz(`${dateString} ${timeString}`, TIME_ZONE).toDate();
}

function projectIdFor(slug, sequence) {
  return `IKC-${slug}-${String(sequence).padStart(4, "0")}`.toLowerCase();
}

// ---------------------------------------------------------------------------
// Clean up a previous run
// ---------------------------------------------------------------------------

async function cleanDemoData() {
  log("Removing previously seeded demo data…");

  const projectIds = [];
  for (const client of CLIENTS) {
    const projects = await prisma.project.findMany({
      where: {
        project_id: { startsWith: `ikc-${client.client_slug.toLowerCase()}-` },
      },
      select: { project_id: true },
    });
    projectIds.push(...projects.map((project) => project.project_id));
  }

  const lots = await prisma.lot.findMany({
    where: { project_id: { in: projectIds } },
    select: { lot_id: true },
  });
  const lotIds = lots.map((lot) => lot.lot_id);

  const usernames = [
    MASTER_ADMIN.username,
    ...EMPLOYEES.map((employee) => employee.user.username),
  ];
  const employeeIds = EMPLOYEES.map((employee) => employee.employee_id);

  await prisma.clock_punch.deleteMany({
    where: { idempotency_key: { startsWith: `${DEMO_TAG}-` } },
  });
  await prisma.stage_employee.deleteMany({
    where: { employee_id: { in: employeeIds } },
  });
  if (lotIds.length) {
    await prisma.stage.deleteMany({ where: { lot_id: { in: lotIds } } });
    await prisma.lot_tab.deleteMany({ where: { lot_id: { in: lotIds } } });
    await prisma.lot.deleteMany({ where: { lot_id: { in: lotIds } } });
  }
  if (projectIds.length) {
    await prisma.project.deleteMany({
      where: { project_id: { in: projectIds } },
    });
  }

  const users = await prisma.users.findMany({
    where: { username: { in: usernames } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length) {
    // Logs are left alone: logs.user_id is SetNull, so the audit trail survives
    // the user being removed.
    await prisma.sessions.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.push_tokens.deleteMany({
      where: { user_id: { in: userIds } },
    });
    await prisma.module_access.deleteMany({
      where: { user_id: { in: userIds } },
    });
    await prisma.notification_config.deleteMany({
      where: { user_id: { in: userIds } },
    });
    await prisma.users.deleteMany({ where: { id: { in: userIds } } });
  }

  await prisma.employees.deleteMany({
    where: { employee_id: { in: employeeIds } },
  });

  const slugs = CLIENTS.map((client) => client.client_slug);
  const demoClients = await prisma.client.findMany({
    where: { client_slug: { in: slugs } },
    select: { client_id: true },
  });
  const clientIds = demoClients.map((client) => client.client_id);
  if (clientIds.length) {
    await prisma.contact.deleteMany({
      where: { client_id: { in: clientIds } },
    });
    await prisma.client.deleteMany({ where: { client_id: { in: clientIds } } });
  }

  log("Demo data removed.");
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function upsertUser({
  username,
  password,
  user_type,
  employee_id = null,
  moduleAccess,
}) {
  const hashedPassword = await bcrypt.hash(password, 10);
  const existing = await prisma.users.findUnique({ where: { username } });

  const user = existing
    ? await prisma.users.update({
        where: { username },
        data: {
          password: hashedPassword,
          user_type,
          is_active: true,
          employee_id,
        },
      })
    : await prisma.users.create({
        data: {
          username,
          password: hashedPassword,
          user_type,
          is_active: true,
          employee_id,
        },
      });

  await prisma.module_access.upsert({
    where: { user_id: user.id },
    update: moduleAccess,
    create: { user_id: user.id, ...moduleAccess },
  });

  return user;
}

async function seedEmployees() {
  const created = [];

  for (const employee of EMPLOYEES) {
    const { user, ...employeeData } = employee;
    const data = {
      ...employeeData,
      dob: employeeData.dob ? new Date(employeeData.dob) : null,
      join_date: employeeData.join_date
        ? new Date(employeeData.join_date)
        : null,
      availability: JSON.stringify(WEEKDAY_AVAILABILITY),
      is_active: true,
      is_deleted: false,
    };

    const record = await prisma.employees.upsert({
      where: { employee_id: employee.employee_id },
      update: data,
      create: data,
    });

    const account = await upsertUser({
      username: user.username,
      password: user.password,
      user_type: user.user_type,
      employee_id: record.employee_id,
      moduleAccess: EMPLOYEE_MODULE_ACCESS,
    });

    created.push({ employee: record, user: account });
    log(
      `  employee ${record.employee_id} — ${record.first_name} ${record.last_name} (login: ${user.username})`,
    );
  }

  return created;
}

async function seedClients() {
  const byKey = new Map();

  for (const client of CLIENTS) {
    const { key, contact, ...clientData } = client;
    const existing = await prisma.client.findUnique({
      where: { client_slug: client.client_slug },
    });

    const record = existing
      ? await prisma.client.update({
          where: { client_id: existing.client_id },
          data: { ...clientData, is_deleted: false },
        })
      : await prisma.client.create({
          data: { ...clientData, is_deleted: false },
        });

    const existingContact = await prisma.contact.findFirst({
      where: {
        client_id: record.client_id,
        first_name: contact.first_name,
        last_name: contact.last_name,
      },
    });
    if (!existingContact) {
      await prisma.contact.create({
        data: { ...contact, client_id: record.client_id },
      });
    }

    byKey.set(key, record);
    log(`  client ${record.client_slug} — ${record.client_name}`);
  }

  return byKey;
}

async function seedProjects(clientsByKey, employees) {
  // Sequences run per client, matching how the app numbers project ids.
  const sequenceByClient = new Map();

  for (const project of PROJECTS) {
    const client = clientsByKey.get(project.clientKey);
    const sequence = (sequenceByClient.get(project.clientKey) ?? 0) + 1;
    sequenceByClient.set(project.clientKey, sequence);
    const projectId = projectIdFor(client.client_slug, sequence);

    const projectRecord = await prisma.project.upsert({
      where: { project_id: projectId },
      update: {
        name: project.name,
        client_id: client.client_id,
        is_deleted: false,
      },
      create: {
        project_id: projectId,
        name: project.name,
        client_id: client.client_id,
        is_deleted: false,
      },
    });
    log(`  project ${projectRecord.project_id} — ${projectRecord.name}`);

    for (const lot of project.lots) {
      const lotId = `${projectId}-${lot.suffix}`.toLowerCase();
      const installer = employees[lot.installerIndex]?.employee ?? null;

      const lotData = {
        name: lot.name,
        project_id: projectRecord.project_id,
        status: lot.status ?? "ACTIVE",
        startDate: dayOffset(project.startOffsetDays),
        installationDueDate: dayOffset(lot.installDueOffsetDays),
        notes: lot.notes,
        installer_id: installer ? installer.employee_id : null,
        installer_notes: installer
          ? `Assigned to ${installer.first_name} ${installer.last_name}.`
          : null,
        is_deleted: false,
      };

      const lotRecord = await prisma.lot.upsert({
        where: { lot_id: lotId },
        update: lotData,
        create: { lot_id: lotId, ...lotData },
      });
      log(`    lot ${lotRecord.lot_id} — ${lotRecord.name}`);

      // Stages are replaced wholesale so re-running never stacks duplicates.
      await prisma.stage.deleteMany({ where: { lot_id: lotRecord.lot_id } });
      for (const stage of lot.stages) {
        const stageRecord = await prisma.stage.create({
          data: {
            lot_id: lotRecord.lot_id,
            name: stage.name,
            status: stage.status,
            startDate:
              stage.startOffset === null ? null : dayOffset(stage.startOffset),
            endDate:
              stage.endOffset === null ? null : dayOffset(stage.endOffset),
            notes: null,
          },
        });

        for (const assigneeIndex of stage.assignees) {
          const assignee = employees[assigneeIndex]?.employee;
          if (!assignee) continue;
          await prisma.stage_employee.create({
            data: {
              stage_id: stageRecord.stage_id,
              employee_id: assignee.employee_id,
            },
          });
        }
      }

      for (const tab of lot.tabs ?? []) {
        await prisma.lot_tab.upsert({
          where: { lot_id_tab: { lot_id: lotRecord.lot_id, tab: tab.tab } },
          update: { notes: tab.notes },
          create: { lot_id: lotRecord.lot_id, tab: tab.tab, notes: tab.notes },
        });
      }
    }
  }
}

async function seedPunches(employees, masterAdmin) {
  for (const plan of PUNCH_PLANS) {
    const target = employees[plan.employeeIndex];
    if (!target) continue;

    let total = 0;
    for (const day of plan.days) {
      const date = weekdayAgo(day.weekdaysAgo);

      for (const [index, punch] of day.punches.entries()) {
        const key = `${DEMO_TAG}-${target.employee.employee_id}-${date}-${index}`;
        const approved = day.review_status === "APPROVED";

        const data = {
          employee_id: target.employee.employee_id,
          user_id: target.user.id,
          action: punch.action,
          punch_type: "EMPLOYEE",
          punched_at: adelaideInstant(date, punch.time),
          review_status: day.review_status,
          reviewed_by_id: approved ? masterAdmin.id : null,
          reviewed_at: approved ? adelaideInstant(date, "16:30") : null,
          review_notes: approved
            ? "Approved during the weekly payroll check."
            : null,
        };

        await prisma.clock_punch.upsert({
          where: { idempotency_key: key },
          update: data,
          create: { ...data, idempotency_key: key },
        });
        total += 1;
      }
    }

    log(
      `  ${total} punches for ${target.employee.first_name} ${target.employee.last_name}`,
    );
  }
}

// ---------------------------------------------------------------------------

async function main() {
  if (shouldReset) {
    try {
      await cleanDemoData();
    } catch (error) {
      if (error?.code === "P2003" || error?.code === "P2014") {
        throw new Error(
          "Could not remove the demo data because other records now reference it " +
            "(a purchase order, material selection or meeting created against a demo " +
            "user or project). Remove those in the app first, then re-run with --reset.",
          { cause: error },
        );
      }
      throw error;
    }
    if (onlyClean) return;
  }

  log("Seeding demo data…");

  const masterAdmin = await upsertUser({
    username: MASTER_ADMIN.username,
    password: MASTER_ADMIN.password,
    user_type: MASTER_ADMIN.user_type,
    moduleAccess: MASTER_MODULE_ACCESS,
  });
  log(`  master admin — ${MASTER_ADMIN.username}`);

  const employees = await seedEmployees();
  const clientsByKey = await seedClients();
  await seedProjects(clientsByKey, employees);
  await seedPunches(employees, masterAdmin);

  log("\nDone. Logins (all use the same password):");
  log(
    `  ${MASTER_ADMIN.username.padEnd(14)} ${MASTER_ADMIN.password}   (master-admin)`,
  );
  for (const employee of EMPLOYEES) {
    log(
      `  ${employee.user.username.padEnd(14)} ${employee.user.password}   (${employee.user.user_type})`,
    );
  }
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
