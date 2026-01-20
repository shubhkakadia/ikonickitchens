"use client";
import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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

// Event type colors with gradients
const eventTypeStyles = {
  installation: {
    bg: "bg-gradient-to-r from-blue-500 to-blue-600",
    light: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
    text: "text-blue-700",
  },
  meeting: {
    bg: "bg-gradient-to-r from-emerald-500 to-emerald-600",
    light: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  inspection: {
    bg: "bg-gradient-to-r from-purple-500 to-purple-600",
    light: "bg-purple-50",
    border: "border-purple-200",
    dot: "bg-purple-500",
    text: "text-purple-700",
  },
  delivery: {
    bg: "bg-gradient-to-r from-amber-500 to-amber-600",
    light: "bg-amber-50",
    border: "border-amber-200",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  default: {
    bg: "bg-gradient-to-r from-slate-500 to-slate-600",
    light: "bg-slate-50",
    border: "border-slate-200",
    dot: "bg-slate-500",
    text: "text-slate-700",
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

  // Fetch meetings for the logged-in user
  const fetchMeetings = async () => {
    try {
      const userData = getUserData();
      const userId = userData?.user?.id;
      if (!userId) return;

      setIsLoadingEvents(true);
      const token = getToken();
      const response = await axios.get(`/api/meeting/all/${userId}`, {
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

  // Fetch meetings on mount
  useEffect(() => {
    const userData = getUserData();
    if (userData?.user?.id) {
      fetchMeetings();
    }
  }, [getUserData()?.user?.id]);

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
      const response = await axios.get("/api/user/all", {
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
      const response = await axios.get("/api/lot/active", {
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
      const response = await axios.delete(`/api/meeting/${eventToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

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
          `/api/meeting/${editingEventId}`,
          meetingData,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } else {
        response = await axios.post("/api/meeting/create", meetingData, {
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
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2 shrink-0">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-700">Calendar</h1>
                <div className="flex items-center gap-2">
                  <SearchBar />
                  <button
                    onClick={handleOpenModal}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium text-sm transition-all duration-200"
                  >
                    <Plus className="h-4 w-4" />
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
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 p-5 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center">
                        <CalendarIcon className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-800">
                        {months[miniCalendarDate.getMonth()].slice(0, 3)}{" "}
                        {miniCalendarDate.getFullYear()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={previousMiniMonth}
                        className="cursor-pointer p-1.5 hover:bg-slate-100 rounded-lg transition-all duration-200 hover:scale-105"
                      >
                        <ChevronLeft className="h-4 w-4 text-slate-500" />
                      </button>
                      <button
                        onClick={nextMiniMonth}
                        className="cursor-pointer p-1.5 hover:bg-slate-100 rounded-lg transition-all duration-200 hover:scale-105"
                      >
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      </button>
                    </div>
                  </div>

                  {/* Mini Calendar Grid - Enhanced */}
                  <div className="grid grid-cols-7 gap-1">
                    {daysOfWeekShort.map((day, idx) => (
                      <div
                        key={idx}
                        className="text-center text-[10px] font-bold text-slate-400 uppercase py-2"
                      >
                        {day}
                      </div>
                    ))}
                    {miniCalendarDays.map((dayObj, index) => {
                      const isTodayDate = isToday(dayObj.date);
                      const isSelectedDate = isSelected(dayObj.date);
                      const hasEventsOnDate = hasEvents(dayObj.date);

                      return (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedDate(dayObj.date);
                            setCurrentDate(dayObj.date);
                          }}
                          className={`
                            relative aspect-square flex flex-col items-center justify-center text-xs cursor-pointer rounded-lg transition-all duration-200
                            ${dayObj.isCurrentMonth ? "text-slate-700 font-medium" : "text-slate-300"}
                            ${isTodayDate ? "bg-linear-to-br from-primary to-primary/80 text-white font-bold" : ""}
                            ${isSelectedDate && !isTodayDate ? "bg-linear-to-br from-blue-100 to-blue-50 text-blue-700 font-semibold ring ring-blue-200" : ""}
                            ${!isTodayDate && !isSelectedDate && dayObj.isCurrentMonth ? "hover:bg-slate-100 hover:scale-105" : ""}
                          `}
                        >
                          {dayObj.day}
                          {hasEventsOnDate && (
                            <div
                              className={`absolute bottom-0.5 flex gap-0.5 ${isTodayDate ? "opacity-80" : ""}`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${isTodayDate ? "bg-white" : "bg-primary"}`}
                              ></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Date Events - Modern Card */}
                {selectedDate && (
                  <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200 overflow-hidden transition-all duration-300">
                    {/* Header with gradient */}
                    <div className="bg-linear-to-r from-slate-800 to-slate-700 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl font-bold text-white">
                          {selectedDate.getDate()}
                        </div>
                        <div>
                          <p className="text-white/90 font-semibold text-sm">
                            {selectedDate.toLocaleDateString("en-US", {
                              weekday: "long",
                            })}
                          </p>
                          <p className="text-white/60 text-xs">
                            {selectedDate.toLocaleDateString("en-US", {
                              month: "long",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {getEventsForDate(selectedDate).map((event) => {
                        const styles =
                          eventTypeStyles[event.type] ||
                          eventTypeStyles.default;
                        return (
                          <div
                            key={event.id}
                            onClick={() => setQuickViewEvent(event)}
                            className={`relative p-4 rounded-xl ${styles.light} border ${styles.border} transition-all duration-200 cursor-pointer group hover:scale-[1.02]`}
                          >
                            {/* Type badge */}
                            <div className="flex items-center justify-between mb-2">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider ${styles.text}`}
                              >
                                {event.type}
                              </span>
                              <span className="text-xs text-slate-500">
                                {event.time}
                              </span>
                            </div>

                            <h4 className="font-bold text-slate-800 text-sm mb-2 group-hover:text-slate-900">
                              {event.title}
                            </h4>

                            {/* Lot Info - Modern */}
                            {event.lot && (
                              <div className="flex items-center gap-2 mb-2 p-2 bg-white/60 rounded-lg">
                                <Home className="h-3.5 w-3.5 text-slate-500" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 truncate">
                                    {event.lot.name}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {event.lot.project}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {getEventsForDate(selectedDate).length === 0 && (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center">
                            <Sparkles className="h-8 w-8 text-slate-300" />
                          </div>
                          <p className="text-sm font-medium text-slate-400">
                            No events
                          </p>
                          <p className="text-xs text-slate-300 mt-1">
                            This day is free!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Next Upcoming Event - Modern Card */}
                {getNextUpcomingEvent && (
                  <div className="bg-linear-to-br from-primary/5 to-primary/10 rounded-2xl border border-primary/20 overflow-hidden transition-all duration-300">
                    <div className="px-5 py-4 border-b border-primary/10">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-linear-to-br from-primary to-primary/80 flex items-center justify-center">
                          <ArrowRight className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">
                          Coming Up
                        </span>
                        <span className="ml-auto text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {getNextUpcomingEvent.date.toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 space-y-3">
                      {getNextUpcomingEvent.events.map((event) => {
                        const styles =
                          eventTypeStyles[event.type] ||
                          eventTypeStyles.default;
                        return (
                          <div
                            key={event.id}
                            className="relative p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`w-1.5 h-12 rounded-full ${styles.dot}`}
                              ></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`text-[10px] font-bold uppercase ${styles.text}`}
                                  >
                                    {event.type}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    • {event.time}
                                  </span>
                                </div>
                                <h4 className="font-bold text-slate-800 text-sm mb-1">
                                  {event.title}
                                </h4>
                                {event.lot && (
                                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    <Home className="h-3 w-3" />
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
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                  {/* Calendar Controls */}
                  <div className="p-4 border-b border-slate-200 shrink-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={previousMonth}
                          className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                        >
                          <ChevronLeft className="h-5 w-5 text-slate-600" />
                        </button>

                        <div className="flex items-center gap-2">
                          {/* Month Dropdown */}
                          <div className="relative calendar-month-dropdown">
                            <button
                              onClick={() => {
                                setMonthDropdownOpen(!monthDropdownOpen);
                                setYearDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              {months[currentDate.getMonth()]}
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {monthDropdownOpen && (
                              <div className="absolute left-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                                {months.map((month, index) => (
                                  <button
                                    key={month}
                                    onClick={() => handleMonthSelect(index)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer ${
                                      currentDate.getMonth() === index
                                        ? "text-primary font-semibold bg-primary/5"
                                        : "text-slate-600"
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
                              onClick={() => {
                                setYearDropdownOpen(!yearDropdownOpen);
                                setMonthDropdownOpen(false);
                              }}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              {currentDate.getFullYear()}
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {yearDropdownOpen && (
                              <div className="absolute left-0 mt-1 w-28 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto">
                                {years.map((year) => (
                                  <button
                                    key={year}
                                    onClick={() => handleYearSelect(year)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer ${
                                      currentDate.getFullYear() === year
                                        ? "text-primary font-semibold bg-primary/5"
                                        : "text-slate-600"
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
                          onClick={nextMonth}
                          className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                        >
                          <ChevronRight className="h-5 w-5 text-slate-600" />
                        </button>

                        <button
                          onClick={goToToday}
                          className="cursor-pointer ml-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors duration-200"
                        >
                          Today
                        </button>
                      </div>
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
                            className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wide py-2"
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

                          return (
                            <div
                              key={index}
                              onClick={() => setSelectedDate(dayObj.date)}
                              className={`
                                min-h-[100px] p-2 border rounded-lg cursor-pointer transition-all duration-200
                                ${
                                  dayObj.isCurrentMonth
                                    ? "bg-white border-slate-200 hover:border-primary hover:shadow-sm"
                                    : "bg-slate-50 border-slate-100 text-slate-400"
                                }
                                ${isTodayDate ? "ring-2 ring-primary ring-offset-1" : ""}
                                ${isSelectedDate ? "bg-blue-50 border-blue-300" : ""}
                              `}
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
                                      className={`${styles.bg} text-white text-xs px-2 py-1 rounded truncate shadow-sm`}
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
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick View Modal */}
      {quickViewEvent && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setQuickViewEvent(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className={`px-5 py-4 bg-linear-to-r from-slate-50 to-white border-b border-slate-100 flex justify-between items-start`}
            >
              <div>
                <h3 className="font-bold text-lg text-slate-800 leading-tight">
                  {quickViewEvent.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      (
                        eventTypeStyles[quickViewEvent.type] ||
                        eventTypeStyles.default
                      ).light
                    } ${(eventTypeStyles[quickViewEvent.type] || eventTypeStyles.default).text}`}
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
                onClick={() => setQuickViewEvent(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Lot Info */}
              {/* Lot Info */}
              {quickViewEvent.lots && quickViewEvent.lots.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Lots
                  </h4>
                  {quickViewEvent.lots.map((lotData, idx) => (
                    <div
                      key={lotData.lot_id || idx}
                      className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                        <Home className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        {/* <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-0.5">
                          Lot
                        </h4> */}
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
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
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
                            className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md mb-1"
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
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">
                    Notes
                  </h4>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl italic">
                    "{quickViewEvent.notes}"
                  </p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 grid grid-cols-2 gap-3 bg-slate-50/50">
              <button
                onClick={() => handleEditEvent(quickViewEvent)}
                className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
              >
                <Pen className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => handleDeleteEvent(quickViewEvent)}
                className="cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                Delete
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
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                {editingEventId ? "Edit Event" : "New Event"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body - Two Column Layout */}
            <div className="flex-5 flex overflow-hidden">
              {/* Left Pane - Form */}
              <div className="flex-3 overflow-y-auto p-6 space-y-5 border-r border-slate-200">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Event Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newEventForm.title}
                    onChange={(e) =>
                      setNewEventForm({
                        ...newEventForm,
                        title: e.target.value,
                      })
                    }
                    placeholder="Enter event title"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                {/* Participants - Multi-select with search */}
                <div className="relative participants-dropdown">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Participants
                  </label>
                  <input
                    type="text"
                    value={participantSearch}
                    onChange={(e) => setParticipantSearch(e.target.value)}
                    onFocus={() => setShowParticipantsDropdown(true)}
                    placeholder={
                      newEventForm.participants.length === 0
                        ? "Search participants..."
                        : `${newEventForm.participants.length} selected - Search more...`
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {/* Selected chips */}
                  {newEventForm.participants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto">
                      {newEventForm.participants.map((user) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium"
                        >
                          {user.name || user.username}
                          <button
                            onClick={() => toggleParticipant(user)}
                            className="cursor-pointer hover:bg-primary/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Dropdown */}
                  {showParticipantsDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
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
                              className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer"
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
                                className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
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
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newEventForm.date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) =>
                        setNewEventForm({
                          ...newEventForm,
                          date: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Start Time
                    </label>
                    <input
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
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      End Time
                    </label>
                    <input
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
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>
                {/* Lots - Multi-select with search */}
                <div className="relative lots-dropdown">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Lots
                  </label>
                  <input
                    type="text"
                    value={lotSearch}
                    onChange={(e) => setLotSearch(e.target.value)}
                    onFocus={() => setShowLotsDropdown(true)}
                    placeholder={
                      newEventForm.lots.length === 0
                        ? "Search lots..."
                        : `${newEventForm.lots.length} selected - Search more...`
                    }
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  {/* Selected chips */}
                  {newEventForm.lots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto">
                      {newEventForm.lots.map((lot) => (
                        <span
                          key={lot.lot_id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium"
                        >
                          {lot.lot_id}
                          <button
                            onClick={() => toggleLot(lot)}
                            className="cursor-pointer hover:bg-emerald-100 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Dropdown */}
                  {showLotsDropdown && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
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
                              className="flex items-center justify-between px-4 py-2 text-sm hover:bg-slate-50 cursor-pointer"
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
                                className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded ml-2"
                              />
                            </label>
                          ))
                      )}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Notes
                  </label>
                  <textarea
                    value={newEventForm.notes}
                    onChange={(e) =>
                      setNewEventForm({
                        ...newEventForm,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Add any notes..."
                    rows={5}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Lots - Multi-select with search - moved here */}
              <div className="relative lots-dropdown flex-2">
                <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
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
                            <div className="opacity-75 truncate text-[10px]">
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
                          className="absolute left-12 right-2 bg-primary/20 border-2 border-primary rounded-lg cursor-move group transition-colors hover:bg-primary/30"
                          style={{
                            top: `${topOffset}px`,
                            height: `${Math.max(height, 24)}px`,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, "move")}
                        >
                          {/* Top resize handle */}
                          <div
                            className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize bg-primary/50 opacity-0 group-hover:opacity-100 rounded-t-md transition-opacity"
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
                            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-primary/50 opacity-0 group-hover:opacity-100 rounded-b-md transition-opacity"
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
                onClick={handleCloseModal}
                className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitEvent}
                disabled={isCreatingEvent}
                className={`cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg transition-colors ${
                  isCreatingEvent
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-primary/90"
                }`}
              >
                {isCreatingEvent ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {editingEventId ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    {editingEventId ? "Update Event" : "Create Event"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRoute>
  );
}
