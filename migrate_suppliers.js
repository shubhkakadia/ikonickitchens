const { PrismaClient } = require("./generated/prisma/index.js");

const prisma = new PrismaClient();

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

      // Check if item_suppliers already exists for this pair
      const existing = await prisma.item_suppliers.findFirst({
        where: {
          item_id: item.item_id,
          supplier_id: item.supplier_id,
        },
      });

      if (!existing) {
        await prisma.item_suppliers.create({
          data: {
            item_id: item.item_id,
            supplier_id: item.supplier_id,
            supplier_reference: item.supplier_reference || null,
            supplier_product_link: item.supplier_product_link || null,
            price: item.price || null,
          },
        });
        migratedCount++;
      } else {
        // Optional: Update fields if they're missing in existing record but present in legacy
        const updateData = {};
        if (!existing.supplier_reference && item.supplier_reference) {
          updateData.supplier_reference = item.supplier_reference;
        }
        if (!existing.supplier_product_link && item.supplier_product_link) {
          updateData.supplier_product_link = item.supplier_product_link;
        }
        if (!existing.price && item.price) {
          updateData.price = item.price;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.item_suppliers.update({
            where: { id: existing.id },
            data: updateData,
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
