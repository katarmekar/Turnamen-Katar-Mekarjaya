"use client";

import { useEffect, useId, useRef, useState } from "react";

const RW_OPTIONS = Array.from({ length: 31 }, (_, i) => {
  const n = i + 1;
  return `RW ${String(n).padStart(2, "0")}`;
});

type RwScrollPickerProps = {
  name?: string;
  required?: boolean;
  defaultValue?: string;
};

export function RwScrollPicker({
  name = "city",
  required = true,
  defaultValue = "",
}: RwScrollPickerProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [draft, setDraft] = useState(defaultValue || RW_OPTIONS[0]);
  const listRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const list = listRef.current;
    const idx = Math.max(0, RW_OPTIONS.indexOf(draft || RW_OPTIONS[0]));
    requestAnimationFrame(() => {
      const el = list?.querySelector<HTMLElement>(`[data-rw-index="${idx}"]`);
      el?.scrollIntoView({ block: "center", behavior: "instant" });
    });

    let frame = 0;
    const syncFromScroll = () => {
      if (!list) return;
      const center = list.getBoundingClientRect().top + list.clientHeight / 2;
      let bestIdx = 0;
      let bestDist = Infinity;
      list.querySelectorAll<HTMLElement>("[data-rw-index]").forEach((el) => {
        const rect = el.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const dist = Math.abs(mid - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = Number(el.dataset.rwIndex);
        }
      });
      const next = RW_OPTIONS[bestIdx];
      if (next) setDraft(next);
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncFromScroll);
    };

    list?.addEventListener("scroll", onScroll, { passive: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      list?.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya sync saat buka
  }, [open]);

  function openPicker() {
    setDraft(value || RW_OPTIONS[0]);
    setOpen(true);
  }

  function confirm() {
    setValue(draft);
    setOpen(false);
  }

  return (
    <div className="rw-picker">
      <input type="hidden" name={name} value={value} required={required} />

      <button
        type="button"
        className="input rw-picker-trigger"
        onClick={openPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={value ? "text-white" : "text-[var(--muted)]"}>
          {value || "Pilih RW"}
        </span>
        <span className="rw-picker-chevron" aria-hidden>
          ⌄
        </span>
      </button>

      {open && (
        <div
          className="rw-picker-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <button
            type="button"
            className="rw-picker-backdrop"
            aria-label="Tutup"
            onClick={() => setOpen(false)}
          />

          <div className="rw-picker-sheet">
            <div className="rw-picker-sheet-header">
              <p id={titleId} className="rw-picker-title">
                Pilih RW
              </p>
              <button
                type="button"
                className="rw-picker-done"
                onClick={confirm}
              >
                Selesai
              </button>
            </div>

            <div className="rw-picker-window">
              <div className="rw-picker-fade rw-picker-fade-top" />
              <div className="rw-picker-highlight" aria-hidden />
              <div className="rw-picker-fade rw-picker-fade-bottom" />

              <div ref={listRef} className="rw-picker-scroll">
                <div className="rw-picker-spacer" />
                {RW_OPTIONS.map((label, index) => {
                  const active = draft === label;
                  return (
                    <button
                      key={label}
                      type="button"
                      data-rw-index={index}
                      className={`rw-picker-item${active ? " is-active" : ""}`}
                      onClick={() => {
                        setDraft(label);
                        setValue(label);
                        setOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                <div className="rw-picker-spacer" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
