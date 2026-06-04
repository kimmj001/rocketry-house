"use client";

import { useEffect } from "react";

function canScrollElement(element: Element, deltaY: number) {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll") return false;
  if (element.scrollHeight <= element.clientHeight + 1) return false;
  if (deltaY > 0) return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  return element.scrollTop > 0;
}

function nearestScrollable(target: EventTarget | null, deltaY: number) {
  let element = target instanceof Element ? target : null;
  while (element && element !== document.body && element !== document.documentElement) {
    if (canScrollElement(element, deltaY)) return element;
    element = element.parentElement;
  }
  return null;
}

export function ScrollNormalizer() {
  useEffect(() => {
    const root = () => document.querySelector<HTMLElement>("[data-site-scroll-root]");

    root()?.focus({ preventScroll: true });

    const onWheel = (event: WheelEvent) => {
      const deltaY = event.deltaY;
      if (!deltaY) return;

      const targetScroller = nearestScrollable(event.target, deltaY);
      const rootScroller = root();
      if (targetScroller) return;

      const scroller = rootScroller ?? document.scrollingElement ?? document.documentElement;
      const viewportHeight = scroller instanceof HTMLElement ? scroller.clientHeight : window.innerHeight;
      const maxScroll = scroller.scrollHeight - viewportHeight;
      if (maxScroll <= 0) return;

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? viewportHeight
            : 1;
      event.preventDefault();
      scroller.scrollBy({ top: deltaY * multiplier, left: event.deltaX * multiplier, behavior: "auto" });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      const scroller = root();
      if (!scroller) return;

      const page = Math.max(240, scroller.clientHeight * 0.82);
      const line = 72;
      const keyScroll: Record<string, number> = {
        PageDown: page,
        PageUp: -page,
        ArrowDown: line,
        ArrowUp: -line,
        Home: -scroller.scrollTop,
        End: scroller.scrollHeight
      };
      const delta = event.key === " " ? page : keyScroll[event.key];
      if (delta === undefined) return;

      event.preventDefault();
      scroller.scrollBy({ top: delta, behavior: "auto" });
    };

    const options = { passive: false, capture: true } as AddEventListenerOptions;
    window.addEventListener("wheel", onWheel, options);
    document.addEventListener("wheel", onWheel, options);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("wheel", onWheel, options);
      document.removeEventListener("wheel", onWheel, options);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, []);

  return null;
}
