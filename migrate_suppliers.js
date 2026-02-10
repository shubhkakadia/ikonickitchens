// const { PrismaClient } = require("@prisma/client");
// const prisma = new PrismaClient();
import { PrismaClient } from "./generated/prisma/index.js";

export const prisma = new PrismaClient();

async function migrateSuppliers() {
  console.log("Starting migration...");

  try {
    // Find items with supplier_id but no ItemSupplier entry (or check if we need to migrate all just in case)
    // We'll migrate items where supplier_id is not null
    const items = await prisma.item.findMany({
      where: {
        supplier_id: { not: null },
      },
      select: {
        item_id: true,
        supplier_id: true,
        supplier_reference: true,
      },
    });

    console.log(`Found ${items.length} items with legacy supplier info.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      if (!item.supplier_id) continue;

      // Check if ItemSupplier already exists for this pair
      const existing = await prisma.itemSupplier.findFirst({
        where: {
          item_id: item.item_id,
          supplier_id: item.supplier_id,
        },
      });

      if (!existing) {
        await prisma.itemSupplier.create({
          data: {
            item_id: item.item_id,
            supplier_id: item.supplier_id,
            supplier_reference: item.supplier_reference || null,
          },
        });
        migratedCount++;
      } else {
        // Optional: Update supplier_reference if it's missing in existing record but present in legacy
        if (!existing.supplier_reference && item.supplier_reference) {
          await prisma.itemSupplier.update({
            where: { id: existing.id },
            data: { supplier_reference: item.supplier_reference },
          });
          migratedCount++; // Count as migrated/updated
        } else {
          skippedCount++;
        }
      }
    }

    console.log(`Migration complete.`);
    console.log(`Migrated/Updated: ${migratedCount}`);
    console.log(`Skipped (already existed): ${skippedCount}`);
  } catch (e) {
    console.error("Migration failed:", e);
  } finally {
    await prisma.$disconnect();
  }
}

migrateSuppliers();
