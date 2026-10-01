// Punch sequencing rules shared by the API routes and the admin UI. Keep this
// module free of server-only imports so the add-punch page can reuse it.

export const CLOCK_PUNCH_ACTION_LIST = [
  "CLOCK_IN",
  "BREAK_IN",
  "BREAK_OUT",
  "CLOCK_OUT",
];

export const CLOCK_PUNCH_ACTION_LABELS = {
  CLOCK_IN: "Clock In",
  BREAK_IN: "Break In",
  BREAK_OUT: "Break Out",
  CLOCK_OUT: "Clock Out",
};

export const CLOCK_PUNCH_MINIMUM_BREAK_MINUTES = 30;

// One shift per day: once the day is clocked out nothing further can be added,
// so CLOCK_OUT is a terminal state rather than the start of another shift.
const NEXT_ACTIONS = {
  CLOCK_IN: ["BREAK_IN", "CLOCK_OUT"],
  BREAK_IN: ["BREAK_OUT"],
  BREAK_OUT: ["BREAK_IN", "CLOCK_OUT"],
  CLOCK_OUT: [],
};

export function getAllowedNextActions(previousAction) {
  return previousAction ? NEXT_ACTIONS[previousAction] || [] : ["CLOCK_IN"];
}

export function formatClockPunchAction(action) {
  return CLOCK_PUNCH_ACTION_LABELS[action] || action || "";
}

// Rejected punches never count towards the day's sequence.
export function getActiveClockPunches(punches) {
  return (punches || [])
    .filter((punch) => punch?.review_status !== "REJECTED")
    .slice()
    .sort(
      (first, second) =>
        new Date(first.punched_at).getTime() -
        new Date(second.punched_at).getTime(),
    );
}

// Walks a list of actions and reports the first one that breaks the sequence.
export function findSequenceViolation(actions, previousAction = null) {
  let lastAction = previousAction;

  for (let index = 0; index < actions.length; index += 1) {
    const allowedActions = getAllowedNextActions(lastAction);
    if (!allowedActions.includes(actions[index])) {
      return { index, action: actions[index], allowedActions, lastAction };
    }

    lastAction = actions[index];
  }

  return null;
}

function getBreakWarnings(punches) {
  const warnings = [];
  let breakStartedAt = null;

  for (const punch of punches) {
    if (punch.action === "BREAK_IN") {
      breakStartedAt = new Date(punch.punched_at).getTime();
      continue;
    }

    if (punch.action === "BREAK_OUT" && breakStartedAt !== null) {
      const minutes = Math.round(
        (new Date(punch.punched_at).getTime() - breakStartedAt) / 60000,
      );

      if (minutes < CLOCK_PUNCH_MINIMUM_BREAK_MINUTES) {
        warnings.push({
          code: "SHORT_BREAK",
          label: `A break of ${minutes} minute${
            minutes === 1 ? "" : "s"
          } is under the ${CLOCK_PUNCH_MINIMUM_BREAK_MINUTES} minute minimum`,
        });
      }

      breakStartedAt = null;
    }
  }

  return warnings;
}

// Describes what a day still needs so the admin can see the gaps before adding
// punches: what is missing, what may be added next, and any advisory issues.
export function summarizeClockPunchDay(punches) {
  const activePunches = getActiveClockPunches(punches);
  const lastPunch = activePunches.at(-1) || null;
  const lastAction = lastPunch?.action || null;

  const missing = [];
  switch (lastAction) {
    case null:
      missing.push({ code: "CLOCK_IN", label: "Clock in" });
      break;
    case "CLOCK_IN":
      missing.push({ code: "CLOCK_OUT", label: "Clock out" });
      break;
    case "BREAK_IN":
      missing.push({ code: "BREAK_OUT", label: "Break out" });
      missing.push({ code: "CLOCK_OUT", label: "Clock out" });
      break;
    case "BREAK_OUT":
      missing.push({ code: "CLOCK_OUT", label: "Clock out" });
      break;
    default:
      break;
  }

  const warnings = getBreakWarnings(activePunches);
  const hasClockOut = activePunches.some(
    (punch) => punch.action === "CLOCK_OUT",
  );
  const hasBreak = activePunches.some((punch) => punch.action === "BREAK_IN");

  if (hasClockOut && !hasBreak) {
    warnings.push({
      code: "NO_BREAK",
      label: "No break was recorded for this shift",
    });
  }

  return {
    activePunches,
    lastPunch,
    lastAction,
    allowedActions: getAllowedNextActions(lastAction),
    isComplete: lastAction === "CLOCK_OUT",
    isEmpty: activePunches.length === 0,
    missing,
    warnings,
  };
}
