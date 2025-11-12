"use client";
import { useDispatch, useSelector } from "react-redux";
import { closeTab, setActiveTab } from "@/state/reducer/tabs";
import { X, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CRMLayout() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { tabs, activeTab } = useSelector((state) => state.tabs);
  const [showScrollButtons, setShowScrollButtons] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabContainerRef = useRef(null);
  
  useEffect(() => {
    if (router.pathname === "/") {
      dispatch(setActiveTab(tabs[0]));
      router.push(tabs[0].href);
    }
  }, [router])
  

  // Check scroll position and update button states
  const checkScrollPosition = () => {
    if (tabContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      setShowScrollButtons(scrollWidth > clientWidth);
    }
  };

  // Scroll functions
  const scrollLeft = () => {
    if (tabContainerRef.current) {
      tabContainerRef.current.scrollBy({ left: -200, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (tabContainerRef.current) {
      tabContainerRef.current.scrollBy({ left: 200, behavior: "smooth" });
    }
  };

  // Check scroll position on mount and when tabs change
  useEffect(() => {
    checkScrollPosition();
    const handleResize = () => checkScrollPosition();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [tabs]);

  // Handle scroll events
  const handleScroll = () => {
    checkScrollPosition();
  };

  return (
    <div className="flex flex-col">
      {/* Tab Bar Container */}
      <div className="relative bg-white border-b border-gray-200 shadow-sm">
        {/* Scroll Buttons */}
        {showScrollButtons && (
          <>
            <button
              onClick={scrollLeft}
              disabled={!canScrollLeft}
              className={`absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-white to-transparent flex items-center justify-center transition-all duration-200 ${
                canScrollLeft
                  ? "text-gray-600 hover:text-[#B92F34] hover:bg-gray-50"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={scrollRight}
              disabled={!canScrollRight}
              className={`absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-white to-transparent flex items-center justify-center transition-all duration-200 ${
                canScrollRight
                  ? "text-gray-600 hover:text-[#B92F34] hover:bg-gray-50"
                  : "text-gray-300 cursor-not-allowed"
              }`}
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Tabs Container */}
        <div
          ref={tabContainerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {tabs.map((tab, index) => (
            <div
              key={tab.id}
              onClick={() => {
                dispatch(setActiveTab(tab));
                router.push(tab.href);
              }}
              className={`
                group relative flex items-center min-w-0 max-w-xs px-4 py-3 cursor-pointer
                transition-all duration-300 ease-in-out transform
                ${
                  activeTab.id === tab.id
                    ? "bg-white border-t-2 border-[#B92F34] text-[#B92F34] shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }
                ${index === 0 ? "ml-0" : ""}
                ${index === tabs.length - 1 ? "mr-0" : ""}
              `}
              style={{
                borderLeft: index > 0 ? "1px solid #e5e7eb" : "none",
                borderRight:
                  index < tabs.length - 1 ? "1px solid #e5e7eb" : "none",
              }}
            >
              {/* Tab Title */}
              <span className="truncate text-sm font-medium pr-2">
                {tab.title}
              </span>

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(closeTab(tab.id));
                }}
                className={`
                  cursor-pointer flex-shrink-0 p-1 rounded-full transition-all duration-200
                  ${
                    activeTab.id === tab.id
                      ? "text-[#B92F34] hover:bg-red-50 hover:text-red-600"
                      : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                  }
                  group-hover:opacity-100 opacity-0
                `}
                aria-label={`Close ${tab.title} tab`}
              >
                <X className="w-3 h-3" />
              </button>

              {/* Active Tab Indicator */}
              {activeTab.id === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#B92F34] to-[#A0252A]"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="flex-1 overflow-auto ">
        {tabs && tabs.length > 0 ? (
          <div className="h-full w-full">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                style={{ display: activeTab.id === tab.id ? "block" : "none" }}
              ></div>
            ))}
          </div>
        ) : (
          <div>
            <h1>No tabs found</h1>
          </div>
        )}
      </div>
    </div>
  );
}
