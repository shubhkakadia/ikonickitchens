const { PrismaClient } = require("../generated/prisma");

const prisma = new PrismaClient();

async function main() {
    // create a new user
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
