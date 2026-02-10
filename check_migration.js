const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkMigration() {
  try {
    const itemsNeedingMigration = await prisma.item.count({
      where: {
        supplier_id: { not: null },
        itemSuppliers: {
          none: {},
        },
      },
    });

    console.log(`Items needing migration: ${itemsNeedingMigration}`);

    if (itemsNeedingMigration > 0) {
      const sample = await prisma.item.findMany({
        where: {
          supplier_id: { not: null },
          itemSuppliers: {
            none: {},
          },
        },
        take: 5,
      });
      console.log("Sample items:", sample);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkMigration();
