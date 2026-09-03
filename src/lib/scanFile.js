import { getClamAV } from "./clamav";
import fs from "fs/promises";

export async function scanFile(filePath) {
  // const clam = await getClamAV();
  // const result = await clam.scanFile(filePath);

  // if (result.isInfected) {
  //   await fs.unlink(filePath);
  //   return {
  //     clean: false,
  //     viruses: result.viruses,
  //   };
  // }

  return { clean: true };
}
