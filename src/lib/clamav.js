import NodeClam from "clamscan";

let clam = null;

export async function getClamAV() {
  if (clam) return clam;

  clam = await new NodeClam().init({
    removeInfected: false,
    quarantineInfected: false,
    scanLog: null,
    debugMode: false,
    clamdscan: {
      socket: "/var/run/clamav/clamd.ctl",
      timeout: 60000,
    },
  });

  return clam;
}
