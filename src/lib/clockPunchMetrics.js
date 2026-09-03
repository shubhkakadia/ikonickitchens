export function calculateClockPunchHours(punches, currentTime = new Date()) {
  const currentTimeMs = new Date(currentTime).getTime();
  const orderedPunches = punches
    .filter((punch) => punch.review_status !== "REJECTED")
    .sort(
      (first, second) =>
        new Date(first.punched_at).getTime() -
        new Date(second.punched_at).getTime(),
    );

  let isClockedIn = false;
  let paidSegmentStartedAt = null;
  let paidMilliseconds = 0;

  const finishPaidSegment = (finishedAt) => {
    if (paidSegmentStartedAt === null) return;

    paidMilliseconds += Math.max(0, finishedAt - paidSegmentStartedAt);
    paidSegmentStartedAt = null;
  };

  for (const punch of orderedPunches) {
    const punchedAt = new Date(punch.punched_at).getTime();
    if (Number.isNaN(punchedAt)) continue;

    switch (punch.action) {
      case "CLOCK_IN":
        if (!isClockedIn) {
          isClockedIn = true;
          paidSegmentStartedAt = punchedAt;
        }
        break;
      case "BREAK_IN":
        if (isClockedIn && paidSegmentStartedAt !== null) {
          finishPaidSegment(punchedAt);
        }
        break;
      case "BREAK_OUT":
        if (isClockedIn && paidSegmentStartedAt === null) {
          paidSegmentStartedAt = punchedAt;
        }
        break;
      case "CLOCK_OUT":
        if (isClockedIn) {
          finishPaidSegment(punchedAt);
          isClockedIn = false;
        }
        break;
    }
  }

  if (
    isClockedIn &&
    paidSegmentStartedAt !== null &&
    !Number.isNaN(currentTimeMs)
  ) {
    finishPaidSegment(currentTimeMs);
  }

  return paidMilliseconds / (60 * 60 * 1000);
}
