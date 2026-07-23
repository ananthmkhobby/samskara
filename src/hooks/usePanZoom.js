import { useCallback, useEffect, useRef, useState } from "react";

// Shared pan/zoom for the tree views: mouse drag, single-finger touch drag,
// real two-finger pinch-to-zoom, and non-passive wheel-zoom (React's
// synthetic onWheel is passive by default, so preventDefault() inside it is
// silently ignored — native listeners are required to actually stop page
// scroll while zooming). Also re-fits on window resize/orientation change.
export function usePanZoom({ contentWidth, contentHeight, minZoom = 0.15, maxZoom = 2.5 }) {
  const wrapRef = useRef(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, zoom: 1 });
  const transformRef = useRef(transform);
  const dragState = useRef(null);
  const pinchState = useRef(null);

  useEffect(() => { transformRef.current = transform; }, [transform]);

  const fitToView = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // No fixed content size (e.g. Banyan's photo already fills its container
    // 1:1) — "fit" just means reset to identity.
    if (!contentWidth || !contentHeight) { setTransform({ x: 0, y: 0, zoom: 1 }); return; }
    const ww = wrap.clientWidth || 900, wh = wrap.clientHeight || 500;
    const zoom = Math.max(minZoom, Math.min(maxZoom, Math.min(1, ww / contentWidth, wh / contentHeight)));
    const x = (ww - contentWidth * zoom) / 2;
    const y = (wh - contentHeight * zoom) / 2;
    setTransform({ x, y, zoom });
  }, [contentWidth, contentHeight, minZoom, maxZoom]);

  useEffect(() => { fitToView(); }, [fitToView]);

  useEffect(() => {
    window.addEventListener("resize", fitToView);
    return () => window.removeEventListener("resize", fitToView);
  }, [fitToView]);

  const zoomBy = useCallback((delta, center) => {
    setTransform((t) => {
      const nextZoom = Math.max(minZoom, Math.min(maxZoom, t.zoom + delta));
      if (!center) return { ...t, zoom: nextZoom };
      const ratio = nextZoom / t.zoom;
      return { x: center.x - (center.x - t.x) * ratio, y: center.y - (center.y - t.y) * ratio, zoom: nextZoom };
    });
  }, [minZoom, maxZoom]);

  function startDrag(clientX, clientY) {
    const t = transformRef.current;
    dragState.current = { startX: clientX, startY: clientY, origX: t.x, origY: t.y };
    wrapRef.current?.classList.add("grabbing");
  }

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    function pinchInfo(touches) {
      const [a, b] = touches;
      const rect = wrap.getBoundingClientRect();
      return {
        dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        cx: (a.clientX + b.clientX) / 2 - rect.left,
        cy: (a.clientY + b.clientY) / 2 - rect.top
      };
    }

    function moveTo(clientX, clientY) {
      const d = dragState.current;
      if (!d) return;
      setTransform((t) => ({ ...t, x: d.origX + (clientX - d.startX), y: d.origY + (clientY - d.startY) }));
    }
    function onMouseMove(e) { moveTo(e.clientX, e.clientY); }
    function onMouseUp() { dragState.current = null; wrap.classList.remove("grabbing"); }

    function onTouchStart(e) {
      if (e.touches.length === 2) {
        const info = pinchInfo(e.touches);
        const t = transformRef.current;
        pinchState.current = { ...info, startZoom: t.zoom, startX: t.x, startY: t.y };
        dragState.current = null;
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        startDrag(touch.clientX, touch.clientY);
      }
    }
    function onTouchMove(e) {
      if (e.touches.length === 2 && pinchState.current) {
        e.preventDefault();
        const info = pinchInfo(e.touches);
        const p = pinchState.current;
        const nextZoom = Math.max(minZoom, Math.min(maxZoom, p.startZoom * (info.dist / p.dist)));
        const ratio = nextZoom / p.startZoom;
        setTransform({ x: p.cx - (p.cx - p.startX) * ratio, y: p.cy - (p.cy - p.startY) * ratio, zoom: nextZoom });
      } else if (e.touches.length === 1 && dragState.current) {
        const touch = e.touches[0];
        moveTo(touch.clientX, touch.clientY);
      }
    }
    function onTouchEnd(e) {
      if (e.touches.length < 2) pinchState.current = null;
      if (e.touches.length === 0) { dragState.current = null; wrap.classList.remove("grabbing"); }
    }
    function onWheel(e) {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      zoomBy(-e.deltaY * 0.0015, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    wrap.addEventListener("touchstart", onTouchStart, { passive: true });
    wrap.addEventListener("touchmove", onTouchMove, { passive: false });
    wrap.addEventListener("touchend", onTouchEnd);
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      wrap.removeEventListener("touchstart", onTouchStart);
      wrap.removeEventListener("touchmove", onTouchMove);
      wrap.removeEventListener("touchend", onTouchEnd);
      wrap.removeEventListener("wheel", onWheel);
    };
  }, [minZoom, maxZoom, zoomBy]);

  return { wrapRef, transform, fitToView, zoomBy, startDrag };
}
