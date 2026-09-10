"use client";
import React, { useState, useEffect, useMemo } from "react";
import AdminShell from "@/components/AdminShell";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Calendar as CalendarIcon,
  ArrowRight,
  Home,
  Sparkles,
  X,
  Check,
  Pen,
  Trash2,
} from "lucide-react";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import SearchBar from "@/components/SearchBar";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";

// Event type colours. Semantic hues per DESIGN.md 5.3; violet is a sanctioned
// categorical hue (5.5) for a type that carries no success/progress meaning.
// Every swatch uses the -100 background / -800 text / -200 border formula.
const eventTypeStyles = {
  installation: {
    light: "bg-blue-100",
    border: "border-blue-200",
    dot: "bg-blue-500",
    text: "text-blue-800",
  },
  meeting: {
    light: "bg-green-100",
    border: "border-green-200",
    dot: "bg-green-500",
    text: "text-green-800",
  },
  inspection: {
    light: "bg-violet-100",
    border: "border-violet-200",
    dot: "bg-violet-500",
    text: "text-violet-800",
  },
  delivery: {
    light: "bg-amber-100",
    border: "border-amber-200",
    dot: "bg-amber-500",
    text: "text-amber-800",
  },
  default: {
    light: "bg-slate-100",
    border: "border-slate-200",
    dot: "bg-slate-500",
    text: "text-slate-800",
  },
};

export default function CalendarPage() {
  const { getToken, getUserData } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [miniCalendarDate, setMiniCalendarDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);

  // Modal states
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [users, setUsers] = useState([]);
  const [lots, setLots] = useState([]);
  const [showParticipantsDropdown, setShowParticipantsDropdown] =
    useState(false);
  const [showLotsDropdown, setShowLotsDropdown] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");
  const [lotSearch, setLotSearch] = useState("");

  // New event form data
  const [newEventForm, setNewEventForm] = useState({
    title: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "10:00",
    participants: [],
    lots: [],
    notes: "",
  });

  const [events, setEvents] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Edit/Delete states
  const [editingEventId, setEditingEventId] = useState(null);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState(null);

  // Fetch every calendar event visible to authenticated users.
  const fetchMeetings = async () => {
    try {
      setIsLoadingEvents(true);
      const token = getToken();
      const response = await axios.get("/api/v1/meeting/all", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.status) {
        // Transform meetings to events format
        const transformedEvents = response.data.data.map((meeting) => ({
          id: meeting.id,
          title: meeting.title,
          date: new Date(meeting.date_time),
          date_time_end: meeting.date_time_end
            ? new Date(meeting.date_time_end)
            : null,
          time: new Date(meeting.date_time).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          type: "meeting",
          notes: meeting.notes,
          participants: meeting.participants,
          lots: meeting.lots,
          lot: meeting.lots?.[0]
            ? {
                id: meeting.lots[0].lot_id,
                name: meeting.lots[0].name,
                project: meeting.lots[0].project?.name || "",
              }
            : null,
        }));
        setEvents(transformedEvents);
      }
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Fetch shared meetings on mount
  useEffect(() => {
    fetchMeetings();
  }, []);

  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const monthsShort = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const daysOfWeekShort = ["S", "M", "T", "W", "T", "F", "S"];

  // Get first day of month
  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Get number of days in month
  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  // Get calendar days array
  const getCalendarDays = (forDate = currentDate) => {
    const firstDay = getFirstDayOfMonth(forDate);
    const daysInMonth = getDaysInMonth(forDate);
    const daysInPrevMonth = new Date(
      forDate.getFullYear(),
      forDate.getMonth(),
      0,
    ).getDate();

    const days = [];

    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
        date: new Date(
          forDate.getFullYear(),
          forDate.getMonth() - 1,
          daysInPrevMonth - i,
        ),
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        date: new Date(forDate.getFullYear(), forDate.getMonth(), i),
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        date: new Date(forDate.getFullYear(), forDate.getMonth() + 1, i),
      });
    }

    return days;
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Check if date is selected
  const isSelected = (date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Check if date has events
  const hasEvents = (date) => {
    return events.some(
      (event) =>
        event.date.getDate() === date.getDate() &&
        event.date.getMonth() === date.getMonth() &&
        event.date.getFullYear() === date.getFullYear(),
    );
  };

  // Get events for a specific date
  const getEventsForDate = (date) => {
    return events.filter(
      (event) =>
        event.date.getDate() === date.getDate() &&
        event.date.getMonth() === date.getMonth() &&
        event.date.getFullYear() === date.getFullYear(),
    );
  };

  // Get next upcoming event
  const getNextUpcomingEvent = useMemo(() => {
    const now = new Date();
    const upcomingEvents = events
      .filter((event) => event.date >= now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (upcomingEvents.length === 0) return null;

    const nextEventDate = upcomingEvents[0].date;
    const eventsOnThatDate = upcomingEvents.filter(
      (event) =>
        event.date.getDate() === nextEventDate.getDate() &&
        event.date.getMonth() === nextEventDate.getMonth() &&
        event.date.getFullYear() === nextEventDate.getFullYear(),
    );

    return {
      date: nextEventDate,
      events: eventsOnThatDate,
    };
  }, [events]);

  // Navigate to previous month
  const previousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1),
    );
  };

  // Navigate to next month
  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1),
    );
  };

  // Mini calendar navigation
  const previousMiniMonth = () => {
    setMiniCalendarDate(
      new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth() - 1),
    );
  };

  const nextMiniMonth = () => {
    setMiniCalendarDate(
      new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth() + 1),
    );
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
    setMiniCalendarDate(new Date());
  };

  // Handle year change
  const handleYearSelect = (year) => {
    setCurrentDate(new Date(year, currentDate.getMonth()));
    setYearDropdownOpen(false);
  };

  // Handle month change
  const handleMonthSelect = (monthIndex) => {
    setCurrentDate(new Date(currentDate.getFullYear(), monthIndex));
    setMonthDropdownOpen(false);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        !event.target.closest(".calendar-month-dropdown") &&
        !event.target.closest(".calendar-year-dropdown")
      ) {
        setMonthDropdownOpen(false);
        setYearDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Generate years array
  const years = Array.from(
    { length: 10 },
    (_, i) => currentDate.getFullYear() - 5 + i,
  );

  const calendarDays = getCalendarDays(currentDate);
  const miniCalendarDays = getCalendarDays(miniCalendarDate);

  // Fetch users and lots when modal opens
  useEffect(() => {
    if (showNewEventModal) {
      fetchUsers();
      fetchLots();
    }
  }, [showNewEventModal]);

  // Close modal dropdowns when clicking outside
  useEffect(() => {
    const handleModalClickOutside = (event) => {
      if (!event.target.closest(".participants-dropdown")) {
        setShowParticipantsDropdown(false);
        setParticipantSearch("");
      }
      if (!event.target.closest(".lots-dropdown")) {
        setShowLotsDropdown(false);
        setLotSearch("");
      }
    };
    if (showNewEventModal) {
      document.addEventListener("mousedown", handleModalClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleModalClickOutside);
    }
  }, [showNewEventModal]);

  const fetchUsers = async () => {
    try {
      const token = getToken();
      const response = await axios.get("/api/v1/user/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.status) {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchLots = async () => {
    try {
      const token = getToken();
      const response = await axios.get("/api/v1/lot/active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.status) {
        setLots(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching lots:", error);
    }
  };

  const resetForm = () => {
    setNewEventForm({
      title: "",
      date: new Date().toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "10:00",
      participants: [],
      lots: [],
      notes: "",
    });
    setEditingEventId(null);
    setSelectedTimelineEvent(null);
  };

  const handleOpenModal = () => {
    resetForm();
    setShowNewEventModal(true);
  };

  const handleCloseModal = () => {
    setShowNewEventModal(false);
    resetForm();
  };

  const toggleParticipant = (user) => {
    setNewEventForm((prev) => ({
      ...prev,
      participants: prev.participants.some((p) => p.id === user.id)
        ? prev.participants.filter((p) => p.id !== user.id)
        : [...prev.participants, user],
    }));
  };

  const toggleLot = (lot) => {
    setNewEventForm((prev) => ({
      ...prev,
      lots: prev.lots.some((l) => l.lot_id === lot.lot_id)
        ? prev.lots.filter((l) => l.lot_id !== lot.lot_id)
        : [...prev.lots, lot],
    }));
  };

  const handleEditEvent = (event) => {
    const startDate = new Date(event.date);
    const endDate = event.date_time_end
      ? new Date(event.date_time_end)
      : new Date(startDate.getTime() + 60 * 60 * 1000);

    setNewEventForm({
      title: event.title,
      date: startDate.toISOString().split("T")[0],
      startTime: startDate.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      endTime: endDate.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      }),
      participants: event.participants || [],
      lots: event.lots || [],
      notes: event.notes || "",
    });
    setEditingEventId(event.id);
    setShowNewEventModal(true); // Open the modal
    setQuickViewEvent(null); // Close quick view if open
  };

  const [quickViewEvent, setQuickViewEvent] = useState(null);

  // Modals close on Escape (DESIGN.md 9.4).
  useEffect(() => {
    if (!quickViewEvent && !showNewEventModal) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (quickViewEvent) setQuickViewEvent(null);
      else handleCloseModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [quickViewEvent, showNewEventModal]);

  // Delete Confirmation states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  const handleDeleteEvent = (event) => {
    // If passed just an ID (backward compatibility), find the event or create dummy
    const targetEvent = event.id ? event : { id: event, title: "this event" };
    setEventToDelete(targetEvent);
    setShowDeleteConfirm(true);
  };

  const proceedDeleteEvent = async () => {
    if (!eventToDelete) return;

    try {
      setIsDeletingEvent(true);
      const token = getToken();
      const response = await axios.delete(
        `/api/v1/meeting/${eventToDelete.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.data.status) {
        toast.success("Event deleted successfully");
        fetchMeetings();
        setQuickViewEvent(null); // Close quick view if open
        if (editingEventId === eventToDelete.id) {
          resetForm();
          handleCloseModal();
        }
        setShowDeleteConfirm(false);
        setEventToDelete(null);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const handleSubmitEvent = async () => {
    if (!newEventForm.title.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    if (!newEventForm.date) {
      toast.error("Please select a date");
      return;
    }
    if (newEventForm.endTime < newEventForm.startTime) {
      toast.error("End time cannot be before start time");
      return;
    }

    try {
      setIsCreatingEvent(true);
      const token = getToken();

      // Construct datetime string directly to preserve "wall time"
      // Sending "2026-01-21T09:00:00" allows the backend to interpret it as Adelaide time
      const startDateTimeStr = `${newEventForm.date}T${newEventForm.startTime}:00`;
      const endDateTimeStr = `${newEventForm.date}T${newEventForm.endTime}:00`;

      // Get participant IDs from form + add current user
      const userData = getUserData();
      const currentUserId = userData?.user?.id;
      const participantIds = newEventForm.participants.map((p) => p.id);

      // Add current user if not already included (only for new events usually, but safe to keep)
      if (currentUserId && !participantIds.includes(currentUserId)) {
        participantIds.push(currentUserId);
      }

      const meetingData = {
        title: newEventForm.title,
        date_time: startDateTimeStr,
        date_time_end: endDateTimeStr,
        notes: newEventForm.notes || null,
        participant_ids: participantIds,
        lot_ids: newEventForm.lots.map((l) => l.lot_id),
      };

      let response;
      console.log(editingEventId);
      if (editingEventId) {
        response = await axios.patch(
          `/api/v1/meeting/${editingEventId}`,
          meetingData,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } else {
        response = await axios.post("/api/v1/meeting/create", meetingData, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (response.data.status) {
        toast.success(
          editingEventId
            ? "Event updated successfully!"
            : "Event created successfully!",
        );
        handleCloseModal();
        fetchMeetings(); // Refresh the events list
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error(error.response?.data?.message || "Failed to save event");
    } finally {
      setIsCreatingEvent(false);
    }
  };

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">Calendar</h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                onClick={handleOpenModal}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                New Event
              </button>
            </div>
          </div>
        </div>

        {/* Main Content - Split Layout */}
        <div className="flex-1 flex overflow-hidden px-4 pb-4 gap-4">
          {/* Left Sidebar - Modern Design */}
          <div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-1">
            {/* Mini Calendar - Modern Card */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                    <CalendarIcon
                      className="w-4 h-4 text-white"
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {months[miniCalendarDate.getMonth()].slice(0, 3)}{" "}
                    {miniCalendarDate.getFullYear()}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={previousMiniMonth}
                    className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMiniMonth}
                    className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                    aria-label="Next month"
                  >
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Mini Calendar Grid - Enhanced */}
              <div className="grid grid-cols-7 gap-1">
                {daysOfWeekShort.map((day, idx) => (
                  <div
                    key={idx}
                    className="text-center text-xs font-medium text-slate-500 uppercase py-2"
                  >
                    {day}
                  </div>
                ))}
                {miniCalendarDays.map((dayObj, index) => {
                  const isTodayDate = isToday(dayObj.date);
                  const isSelectedDate = isSelected(dayObj.date);
                  const hasEventsOnDate = hasEvents(dayObj.date);

                  const miniDayState = isTodayDate
                    ? "bg-primary border-primary text-white font-semibold"
                    : isSelectedDate
                      ? "bg-blue-100 border-blue-200 text-blue-800 font-medium"
                      : dayObj.isCurrentMonth
                        ? "border-transparent text-slate-700 font-medium hover:bg-slate-100"
                        : "border-transparent text-slate-400";

                  return (
                    <button
                      type="button"
                      key={index}
                      onClick={() => {
                        setSelectedDate(dayObj.date);
                        setCurrentDate(dayObj.date);
                      }}
                      aria-pressed={isSelectedDate}
                      aria-label={dayObj.date.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                      className={`relative aspect-square flex flex-col items-center justify-center text-xs cursor-pointer rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${miniDayState}`}
                    >
                      {dayObj.day}
                      {hasEventsOnDate && (
                        <span className="absolute bottom-0.5 flex gap-0.5">
                          <span
                            className={`w-1 h-1 rounded-full ${isTodayDate ? "bg-white" : "bg-primary"}`}
                          ></span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Events - Modern Card */}
            {selectedDate && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-semibold text-slate-800">
                      {selectedDate.getDate()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {selectedDate.toLocaleDateString("en-US", {
                          weekday: "long",
                        })}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedDate.toLocaleDateString("en-US", {
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {getEventsForDate(selectedDate).map((event) => {
                    const styles =
                      eventTypeStyles[event.type] || eventTypeStyles.default;
                    return (
                      <button
                        type="button"
                        key={event.id}
                        onClick={() => setQuickViewEvent(event)}
                        className={`relative w-full text-left p-3 rounded-lg ${styles.light} border ${styles.border} cursor-pointer transition-colors duration-200 hover:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary`}
                      >
                        {/* Type badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span
                            className={`text-xs font-medium uppercase tracking-wider ${styles.text}`}
                          >
                            {event.type}
                          </span>
                          <span className="text-xs text-slate-500">
                            {event.time}
                          </span>
                        </div>

                        <h4 className="text-sm font-semibold text-slate-800 mb-2">
                          {event.title}
                        </h4>

                        {/* Lot Info */}
                        {event.lot && (
                          <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg">
                            <Home
                              className="w-4 h-4 text-slate-500 shrink-0"
                              aria-hidden="true"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">
                                {event.lot.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {event.lot.project}
                              </p>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {getEventsForDate(selectedDate).length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
                      <Sparkles
                        className="w-8 h-8 text-slate-300"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-slate-600">
                        No events on this day
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenModal}
                        className="cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200"
                      >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        New Event
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Next Upcoming Event - Modern Card */}
            {getNextUpcomingEvent && (
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center shrink-0">
                      <ArrowRight
                        className="w-3 h-3 text-white"
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-800">
                      Coming Up
                    </span>
                    <span className="ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-primary bg-primary/10 border border-primary/20">
                      {getNextUpcomingEvent.date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {getNextUpcomingEvent.events.map((event) => {
                    const styles =
                      eventTypeStyles[event.type] || eventTypeStyles.default;
                    return (
                      <div
                        key={event.id}
                        className="relative p-3 bg-slate-50 border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`w-1 h-12 rounded-full shrink-0 ${styles.dot}`}
                            aria-hidden="true"
                          ></span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs font-medium uppercase tracking-wider ${styles.text}`}
                              >
                                {event.type}
                              </span>
                              <span className="text-xs text-slate-500">
                                • {event.time}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold text-slate-800 mb-1">
                              {event.title}
                            </h4>
                            {event.lot && (
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Home
                                  className="w-3 h-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {event.lot.name}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Side - Main Calendar */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
              {/* Calendar Controls */}
              <div className="p-4 border-b border-slate-200 shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={previousMonth}
                      className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                      aria-label="Previous month"
                    >
                      <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>

                    <div className="flex items-center gap-2">
                      {/* Month Dropdown */}
                      <div className="relative calendar-month-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setMonthDropdownOpen(!monthDropdownOpen);
                            setYearDropdownOpen(false);
                          }}
                          aria-expanded={monthDropdownOpen}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                        >
                          {months[currentDate.getMonth()]}
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        </button>
                        {monthDropdownOpen && (
                          <div className="absolute left-0 z-40 mt-1 w-40 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
                            {months.map((month, index) => (
                              <button
                                type="button"
                                key={month}
                                onClick={() => handleMonthSelect(index)}
                                className={`cursor-pointer w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors ${
                                  currentDate.getMonth() === index
                                    ? "text-primary font-medium bg-primary/10"
                                    : "text-slate-700"
                                }`}
                              >
                                {month}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Year Dropdown */}
                      <div className="relative calendar-year-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setYearDropdownOpen(!yearDropdownOpen);
                            setMonthDropdownOpen(false);
                          }}
                          aria-expanded={yearDropdownOpen}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                        >
                          {currentDate.getFullYear()}
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                        </button>
                        {yearDropdownOpen && (
                          <div className="absolute left-0 z-40 mt-1 w-28 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
                            {years.map((year) => (
                              <button
                                type="button"
                                key={year}
                                onClick={() => handleYearSelect(year)}
                                className={`cursor-pointer w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors ${
                                  currentDate.getFullYear() === year
                                    ? "text-primary font-medium bg-primary/10"
                                    : "text-slate-700"
                                }`}
                              >
                                {year}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={nextMonth}
                      className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                      aria-label="Next month"
                    >
                      <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={goToToday}
                      className="cursor-pointer ml-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                    >
                      Today
                    </button>
                  </div>

                  {isLoadingEvents && (
                    <div
                      className="flex items-center gap-2 text-xs text-slate-500"
                      role="status"
                    >
                      <span className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                      Loading events…
                    </div>
                  )}
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="flex-1 overflow-auto p-4">
                <div className="min-h-full">
                  {/* Days of Week Header */}
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {daysOfWeek.map((day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-2"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Days Grid */}
                  <div className="grid grid-cols-7 gap-2 auto-rows-fr">
                    {calendarDays.map((dayObj, index) => {
                      const dayEvents = getEventsForDate(dayObj.date);
                      const isTodayDate = isToday(dayObj.date);
                      const isSelectedDate = isSelected(dayObj.date);

                      const dayBackground = isSelectedDate
                        ? "bg-blue-50"
                        : dayObj.isCurrentMonth
                          ? "bg-white"
                          : "bg-slate-50 text-slate-400";
                      const dayBorder = isTodayDate
                        ? "border-primary"
                        : isSelectedDate
                          ? "border-blue-300"
                          : dayObj.isCurrentMonth
                            ? "border-slate-200 hover:border-primary/25"
                            : "border-slate-200";

                      return (
                        <button
                          type="button"
                          key={index}
                          onClick={() => setSelectedDate(dayObj.date)}
                          aria-pressed={isSelectedDate}
                          className={`min-h-[100px] p-2 border rounded-lg text-left cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${dayBackground} ${dayBorder}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span
                              className={`
                                  text-sm font-semibold
                                  ${
                                    isTodayDate
                                      ? "bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"
                                      : dayObj.isCurrentMonth
                                        ? "text-slate-700"
                                        : "text-slate-400"
                                  }
                                `}
                            >
                              {dayObj.day}
                            </span>
                          </div>

                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((event) => {
                              const styles =
                                eventTypeStyles[event.type] ||
                                eventTypeStyles.default;
                              return (
                                <div
                                  key={event.id}
                                  className={`${styles.light} ${styles.text} border ${styles.border} text-xs font-medium px-2 py-1 rounded-sm truncate`}
                                  title={`${event.title}${event.lot ? ` - ${event.lot.name}` : ""}`}
                                >
                                  {event.time} - {event.title}
                                </div>
                              );
                            })}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-slate-500 px-2">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Quick View Modal */}
      {quickViewEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => setQuickViewEvent(null)}
          role="dialog"
          aria-modal="true"
          aria-label={quickViewEvent.title}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-800 leading-tight">
                  {quickViewEvent.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase border ${
                      (
                        eventTypeStyles[quickViewEvent.type] ||
                        eventTypeStyles.default
                      ).light
                    } ${(eventTypeStyles[quickViewEvent.type] || eventTypeStyles.default).text} ${(eventTypeStyles[quickViewEvent.type] || eventTypeStyles.default).border}`}
                  >
                    {quickViewEvent.type}
                  </span>
                  <span className="text-xs text-slate-500">
                    {quickViewEvent.time} -{" "}
                    {quickViewEvent.date_time_end
                      ? new Date(
                          quickViewEvent.date_time_end,
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "..."}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickViewEvent(null)}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Lot Info */}
              {/* Lot Info */}
              {quickViewEvent.lots && quickViewEvent.lots.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Lots
                  </h4>
                  {quickViewEvent.lots.map((lotData, idx) => (
                    <div
                      key={lotData.lot_id || idx}
                      className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <Home
                          className="w-4 h-4 text-slate-500"
                          aria-hidden="true"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          {lotData.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {lotData.project?.name || lotData.project}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Participants */}
              {quickViewEvent.participants &&
                quickViewEvent.participants.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                      Participants
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {quickViewEvent.participants.map((p) => {
                        const displayName = p.employee?.first_name
                          ? `${p.employee.first_name} ${p.employee.last_name || ""}`.trim()
                          : p.name || p.username;
                        return (
                          <span
                            key={p.id}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200"
                          >
                            {displayName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Notes */}
              {quickViewEvent.notes && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                    Notes
                  </h4>
                  <p className="text-sm text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg whitespace-pre-line">
                    {quickViewEvent.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="grid grid-cols-2 gap-3 px-6 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleDeleteEvent(quickViewEvent)}
                className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => handleEditEvent(quickViewEvent)}
                className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200"
              >
                <Pen className="w-4 h-4" aria-hidden="true" />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setEventToDelete(null);
        }}
        onConfirm={proceedDeleteEvent}
        heading="Meeting"
        comparingName={eventToDelete?.title || ""}
        deleteWithInput={false}
        isDeleting={isDeletingEvent}
      />

      {/* New Event Modal */}
      {showNewEventModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
          aria-label={editingEventId ? "Edit Event" : "New Event"}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingEventId ? "Edit Event" : "New Event"}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body - Two Column Layout */}
            <div className="flex-5 flex overflow-hidden">
              {/* Left Pane - Form */}
              <div className="flex-3 overflow-y-auto p-6 space-y-4 border-r border-slate-200">
                {/* Title */}
                <div>
                  <label
                    htmlFor="event-title"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Event Title <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="event-title"
                    type="text"
                    value={newEventForm.title}
                    onChange={(e) =>
                      setNewEventForm({
                        ...newEventForm,
                        title: e.target.value,
                      })
                    }
                    placeholder="Enter event title"
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Participants - Multi-select with search */}
                <div className="relative participants-dropdown">
                  <label
                    htmlFor="event-participants"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Participants
                  </label>
                  <input
                    id="event-participants"
                    type="text"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    onFocus={() => setShowParticipantsDropdown(true)}
                    placeholder={
                      newEventForm.participants.length === 0
                        ? "Search participants..."
                        : `${newEventForm.participants.length} selected - Search more...`
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {/* Selected chips */}
                  {newEventForm.participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto">
                      {newEventForm.participants.map((user) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                        >
                          {user.name || user.username}
                          <button
                            type="button"
                            onClick={() => toggleParticipant(user)}
                            className="cursor-pointer hover:bg-primary/20 rounded-full p-0.5 transition-colors duration-200"
                            aria-label={`Remove ${user.name || user.username}`}
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Dropdown */}
                  {showParticipantsDropdown && (
                    <div className="absolute left-0 right-0 z-40 mt-1 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
                      {users.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          Loading users...
                        </div>
                      ) : (
                        users
                          .filter((user) => {
                            const searchLower = participantSearch.toLowerCase();
                            const name = (
                              user.name ||
                              user.username ||
                              ""
                            ).toLowerCase();
                            return name.includes(searchLower);
                          })
                          .map((user) => (
                            <label
                              key={user.id}
                              className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <span className="text-slate-700">
                                {user.name || user.username}
                              </span>
                              <input
                                type="checkbox"
                                checked={newEventForm.participants.some(
                                  (p) => p.id === user.id,
                                )}
                                onChange={() => toggleParticipant(user)}
                                className="w-4 h-4 accent-primary border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </label>
                          ))
                      )}
                      {users.length > 0 &&
                        users.filter((user) => {
                          const searchLower = participantSearch.toLowerCase();
                          const name = (
                            user.name ||
                            user.username ||
                            ""
                          ).toLowerCase();
                          return name.includes(searchLower);
                        }).length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-500">
                            No participants found
                          </div>
                        )}
                    </div>
                  )}
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="event-date"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Date <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="event-date"
                      type="date"
                      value={newEventForm.date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setNewEventForm({
                          ...newEventForm,
                          date: e.target.value,
                        })
                      }
                      className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="event-start-time"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Start Time
                    </label>
                    <input
                      id="event-start-time"
                      type="time"
                      value={newEventForm.startTime}
                      onChange={(e) => {
                        const newStartTime = e.target.value;
                        setNewEventForm((prev) => ({
                          ...prev,
                          startTime: newStartTime,
                          endTime:
                            prev.endTime < newStartTime
                              ? newStartTime
                              : prev.endTime,
                        }));
                      }}
                      className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="event-end-time"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      End Time
                    </label>
                    <input
                      id="event-end-time"
                      type="time"
                      value={newEventForm.endTime}
                      min={newEventForm.startTime}
                      onChange={(e) => {
                        const newEndTime = e.target.value;
                        if (newEndTime >= newEventForm.startTime) {
                          setNewEventForm({
                            ...newEventForm,
                            endTime: newEndTime,
                          });
                        } else {
                          toast.error("End time cannot be before start time");
                        }
                      }}
                      className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                {/* Lots - Multi-select with search */}
                <div className="relative lots-dropdown">
                  <label
                    htmlFor="event-lots"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Lots
                  </label>
                  <input
                    id="event-lots"
                    type="text"
                    value={lotSearch}
                    onChange={(e) => setLotSearch(e.target.value)}
                    onFocus={() => setShowLotsDropdown(true)}
                    placeholder={
                      newEventForm.lots.length === 0
                        ? "Search lots..."
                        : `${newEventForm.lots.length} selected - Search more...`
                    }
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {/* Selected chips */}
                  {newEventForm.lots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto">
                      {newEventForm.lots.map((lot) => (
                        <span
                          key={lot.lot_id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                        >
                          {lot.lot_id}
                          <button
                            type="button"
                            onClick={() => toggleLot(lot)}
                            className="cursor-pointer hover:bg-green-200 rounded-full p-0.5 transition-colors duration-200"
                            aria-label={`Remove lot ${lot.lot_id}`}
                          >
                            <X className="w-3 h-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Dropdown */}
                  {showLotsDropdown && (
                    <div className="absolute left-0 right-0 z-40 mt-1 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
                      {lots.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          Loading lots...
                        </div>
                      ) : lots.filter((lot) => {
                          const searchLower = lotSearch.toLowerCase();
                          const lotId = (lot.lot_id || "").toLowerCase();
                          const projectName = (
                            lot.project?.name || ""
                          ).toLowerCase();
                          return (
                            lotId.includes(searchLower) ||
                            projectName.includes(searchLower)
                          );
                        }).length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          No lots found
                        </div>
                      ) : (
                        lots
                          .filter((lot) => {
                            const searchLower = lotSearch.toLowerCase();
                            const lotId = (lot.lot_id || "").toLowerCase();
                            const projectName = (
                              lot.project?.name || ""
                            ).toLowerCase();
                            return (
                              lotId.includes(searchLower) ||
                              projectName.includes(searchLower)
                            );
                          })
                          .map((lot) => (
                            <label
                              key={lot.lot_id}
                              className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-slate-700 font-medium">
                                  {lot.project?.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate">
                                  {lot.lot_id}
                                </p>
                              </div>
                              <input
                                type="checkbox"
                                checked={newEventForm.lots.some(
                                  (l) => l.lot_id === lot.lot_id,
                                )}
                                onChange={() => toggleLot(lot)}
                                className="w-4 h-4 ml-2 accent-primary border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                              />
                            </label>
                          ))
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label
                    htmlFor="event-notes"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Notes
                  </label>
                  <textarea
                    id="event-notes"
                    value={newEventForm.notes}
                    onChange={(e) =>
                      setNewEventForm({
                        ...newEventForm,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Add any notes..."
                    rows={5}
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Lots - Multi-select with search - moved here */}
              <div className="relative lots-dropdown flex-2">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Timeline
                  </span>
                </div>
                <div
                  className="relative h-full overflow-y-auto"
                  style={{ scrollbarWidth: "thin" }}
                >
                  {/* Hours Grid */}
                  <div className="relative" style={{ height: `${17 * 48}px` }}>
                    {/* Hour lines from 6 AM to 10 PM */}
                    {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full flex items-start border-t border-slate-100"
                        style={{
                          top: `${(hour - 6) * 48}px`,
                          height: "48px",
                        }}
                      >
                        <div className="w-12 shrink-0 text-xs text-slate-400 pr-2 text-right pt-0.5">
                          {hour === 0
                            ? "12 AM"
                            : hour < 12
                              ? `${hour} AM`
                              : hour === 12
                                ? "12 PM"
                                : `${hour - 12} PM`}
                        </div>
                        <div className="flex-1 h-full border-l border-slate-200"></div>
                      </div>
                    ))}

                    {/* Existing Events on Timeline */}
                    {(() => {
                      if (!newEventForm.date) return null;
                      const [y, m, d] = newEventForm.date
                        .split("-")
                        .map(Number);
                      const formDate = new Date(y, m - 1, d);
                      const existingEvents = getEventsForDate(formDate);

                      return existingEvents.map((event) => {
                        const start = event.date;
                        const end =
                          event.date_time_end ||
                          new Date(start.getTime() + 60 * 60 * 1000); // Default 1h if missing

                        const startMinutes =
                          start.getHours() * 60 + start.getMinutes();
                        const endMinutes =
                          end.getHours() * 60 + end.getMinutes();

                        // Only show if it overlaps with 6 AM - 11 PM (which is the grid range)
                        // Also skip if it is the event currently being edited
                        if (
                          endMinutes < 360 ||
                          startMinutes > 1380 ||
                          event.id === editingEventId
                        )
                          return null;

                        const topOffset = ((startMinutes - 360) / 60) * 48;
                        const height = ((endMinutes - startMinutes) / 60) * 48;

                        const styles =
                          eventTypeStyles[event.type] ||
                          eventTypeStyles.default;

                        return (
                          <div
                            key={event.id}
                            className={`absolute left-0 right-2 rounded-lg border px-2 py-1 text-xs overflow-hidden ${styles.light} ${styles.border} ${styles.text}`}
                            style={{
                              top: `${topOffset}px`,
                              height: `${Math.max(height, 24)}px`,
                              width: "calc(100% - 3.5rem)",
                              left: "3.5rem",
                              right: "0.5rem",
                              zIndex: 5,
                              opacity: 0.7,
                            }}
                            title={`${event.title} (${event.time} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`}
                          >
                            <div className="font-semibold truncate">
                              {event.title}
                            </div>
                            <div className="opacity-75 truncate text-xs">
                              {event.time} -{" "}
                              {end.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Draggable Time Block */}
                    {(() => {
                      const [sh, sm] = newEventForm.startTime
                        .split(":")
                        .map(Number);
                      const [eh, em] = newEventForm.endTime
                        .split(":")
                        .map(Number);
                      const startMinutes = sh * 60 + sm;
                      const endMinutes = eh * 60 + em;
                      const topOffset = ((startMinutes - 360) / 60) * 48; // 360 = 6 AM in minutes
                      const height = ((endMinutes - startMinutes) / 60) * 48;

                      const handleMouseDown = (e, type) => {
                        e.preventDefault();
                        const container =
                          e.target.closest(".relative").parentElement;
                        const rect = container.getBoundingClientRect();
                        const scrollTop = container.scrollTop;

                        const handleMouseMove = (moveEvent) => {
                          const y = moveEvent.clientY - rect.top + scrollTop;
                          const minutes = Math.round((y / 48) * 60) + 360;
                          const snappedMinutes = Math.round(minutes / 15) * 15; // Snap to 15 min
                          const hours = Math.floor(snappedMinutes / 60);
                          const mins = snappedMinutes % 60;
                          const timeStr = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;

                          if (type === "move") {
                            const duration = endMinutes - startMinutes;
                            const newStartMins = Math.max(
                              360,
                              Math.min(snappedMinutes, 1320 - duration),
                            );
                            const newEndMins = newStartMins + duration;
                            const newStartH = Math.floor(newStartMins / 60);
                            const newStartM = newStartMins % 60;
                            const newEndH = Math.floor(newEndMins / 60);
                            const newEndM = newEndMins % 60;
                            setNewEventForm((prev) => ({
                              ...prev,
                              startTime: `${newStartH.toString().padStart(2, "0")}:${newStartM.toString().padStart(2, "0")}`,
                              endTime: `${newEndH.toString().padStart(2, "0")}:${newEndM.toString().padStart(2, "0")}`,
                            }));
                          } else if (type === "top") {
                            const newStartMins = Math.max(
                              360,
                              Math.min(snappedMinutes, endMinutes - 15),
                            );
                            const newStartH = Math.floor(newStartMins / 60);
                            const newStartM = newStartMins % 60;
                            setNewEventForm((prev) => ({
                              ...prev,
                              startTime: `${newStartH.toString().padStart(2, "0")}:${newStartM.toString().padStart(2, "0")}`,
                            }));
                          } else if (type === "bottom") {
                            const newEndMins = Math.max(
                              startMinutes + 15,
                              Math.min(snappedMinutes, 1380),
                            );
                            const newEndH = Math.floor(newEndMins / 60);
                            const newEndM = newEndMins % 60;
                            setNewEventForm((prev) => ({
                              ...prev,
                              endTime: `${newEndH.toString().padStart(2, "0")}:${newEndM.toString().padStart(2, "0")}`,
                            }));
                          }
                        };

                        const handleMouseUp = () => {
                          document.removeEventListener(
                            "mousemove",
                            handleMouseMove,
                          );
                          document.removeEventListener(
                            "mouseup",
                            handleMouseUp,
                          );
                        };

                        document.addEventListener("mousemove", handleMouseMove);
                        document.addEventListener("mouseup", handleMouseUp);
                      };

                      return (
                        <div
                          className="absolute left-12 right-2 bg-primary/20 border border-primary rounded-lg cursor-move group transition-colors duration-200 hover:bg-primary/30"
                          style={{
                            top: `${topOffset}px`,
                            height: `${Math.max(height, 24)}px`,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, "move")}
                        >
                          {/* Top resize handle */}
                          <div
                            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize bg-primary/50 opacity-0 group-hover:opacity-100 rounded-t-lg transition-opacity duration-200"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleMouseDown(e, "top");
                            }}
                          />
                          {/* Content */}
                          <div className="px-2 py-1 text-xs font-medium text-primary truncate">
                            {newEventForm.title || "New Event"}
                          </div>
                          {/* Bottom resize handle */}
                          <div
                            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-primary/50 opacity-0 group-hover:opacity-100 rounded-b-lg transition-opacity duration-200"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              handleMouseDown(e, "bottom");
                            }}
                          />
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={handleCloseModal}
                className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitEvent}
                disabled={isCreatingEvent}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingEvent ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {editingEventId ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    {editingEventId ? "Update Event" : "Create Event"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
