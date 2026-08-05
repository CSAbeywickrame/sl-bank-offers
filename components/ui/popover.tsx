"use client";

import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";

// Dismissal behaviour shared by dropdown-style popovers: closes on outside click or Escape
export function usePopover(): {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  containerRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
} {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Closes the panel when a mousedown happens outside the field container
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Closes the panel on Escape and returns focus to the toggle button
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return { isOpen, setIsOpen, containerRef, triggerRef };
}
