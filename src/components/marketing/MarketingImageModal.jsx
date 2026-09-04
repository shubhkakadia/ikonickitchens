"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function MarketingImageModal({ src, alt, onClose }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="marketing-image-modal"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        className="marketing-image-modal__close"
        aria-label="Close full-screen image"
        onClick={onClose}
      >
        <span aria-hidden="true">×</span>
      </button>

      <div className="marketing-image-modal__canvas">
        <Image
          src={src}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className="marketing-image-modal__image"
        />
      </div>
    </div>,
    document.body,
  );
}
