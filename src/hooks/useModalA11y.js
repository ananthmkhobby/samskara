import { useEffect, useRef } from "react";

// Shared keyboard behavior every modal-style overlay in the app should
// have, and almost none of them did: Escape closes it, and Tab/Shift+Tab
// stays inside it instead of leaking focus out to the page behind. Attach
// the returned ref to the modal PANEL element (not the backdrop) and
// spread the rest of the returned props onto that same element.
//
// `active` lets a caller skip trapping focus on a sub-step that isn't
// really its own dialog (e.g. a confirmation phase inside a larger flow) —
// defaults to true, matching every ordinary modal's single-panel shape.
export function useModalA11y(onClose, active = true) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    if (!panel) return;

    // Focus something inside the modal on mount, so Tab starts trapping
    // immediately rather than leaving focus on whatever triggered it —
    // falls back to the panel itself (tabIndex=-1, below) when there's
    // nothing focusable inside yet (e.g. a lightbox with just an image).
    const previouslyFocused = document.activeElement;
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const firstFocusable = panel.querySelector(focusableSelector);
    (firstFocusable || panel).focus({ preventScroll: true });

    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = panel.querySelectorAll(focusableSelector);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    panel.addEventListener("keydown", onKeyDown);
    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      // Hand focus back to whatever opened the modal, so a keyboard user
      // doesn't lose their place in the page once it closes.
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus({ preventScroll: true });
    };
  }, [onClose, active]);

  return { ref: panelRef, role: "dialog", "aria-modal": true, tabIndex: -1 };
}
