import {
  CalendarClock,
  CalendarPlus,
  FileUp,
  FolderPen,
  FolderPlus,
  ListChecks,
  PackageCheck,
  PackagePlus,
  Receipt,
  StickyNote,
} from "lucide-react";
import { BADGE_TONES } from "@/app/admin/dashboard/lib/format";

// Icon and colour for each update type. Hues follow the DESIGN.md badge tones.
export const UPDATE_TYPE_UI = {
  CALENDAR_EVENT_CREATED: { icon: CalendarPlus, tone: BADGE_TONES.indigo },
  CALENDAR_EVENT_UPDATED: { icon: CalendarClock, tone: BADGE_TONES.indigo },
  PROJECT_CREATED: { icon: FolderPlus, tone: BADGE_TONES.success },
  PROJECT_UPDATED: { icon: FolderPen, tone: BADGE_TONES.info },
  STAGE_UPDATED: { icon: ListChecks, tone: BADGE_TONES.warning },
  LOT_NOTES_UPDATED: { icon: StickyNote, tone: BADGE_TONES.neutral },
  LOT_FILE_UPLOADED: { icon: FileUp, tone: BADGE_TONES.violet },
  MTO_CREATED: { icon: PackagePlus, tone: BADGE_TONES.success },
  MTO_ORDERED: { icon: PackageCheck, tone: BADGE_TONES.info },
  SUPPLIER_STATEMENT_ADDED: { icon: Receipt, tone: BADGE_TONES.warning },
};

export const UPDATE_TYPE_LABELS = {
  CALENDAR_EVENT_CREATED: "Calendar event created",
  CALENDAR_EVENT_UPDATED: "Calendar event updated",
  PROJECT_CREATED: "Project created",
  PROJECT_UPDATED: "Project updated",
  STAGE_UPDATED: "Stage updated",
  LOT_NOTES_UPDATED: "Lot notes updated",
  LOT_FILE_UPLOADED: "Lot file uploaded",
  MTO_CREATED: "Materials to order created",
  MTO_ORDERED: "Materials ordered",
  SUPPLIER_STATEMENT_ADDED: "Supplier statement added",
};
