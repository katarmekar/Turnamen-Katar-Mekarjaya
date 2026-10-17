"use client";

import { useState } from "react";

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatRupiahDisplay(digits: string) {
  if (!digits) return "";
  const n = Number(digits);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

type IdrMoneyInputProps = {
  name: string;
  defaultValue?: number;
  className?: string;
  required?: boolean;
};

/**
 * Input biaya dengan tampilan Rupiah (Rp 200.000).
 * Nilai numerik dikirim lewat hidden input `name`.
 */
export function IdrMoneyInput({
  name,
  defaultValue = 0,
  className = "input",
  required,
}: IdrMoneyInputProps) {
  const initial = Number.isFinite(defaultValue)
    ? String(Math.max(0, Math.round(defaultValue)))
    : "0";
  const [digits, setDigits] = useState(initial);

  return (
    <>
      <input type="hidden" name={name} value={digits || "0"} />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={className}
        required={required}
        value={formatRupiahDisplay(digits)}
        placeholder="Rp 0"
        onChange={(e) => {
          const next = digitsOnly(e.target.value);
          // Batasi panjang agar tidak overflow Number
          setDigits(next.slice(0, 12));
        }}
        onBlur={() => {
          if (!digits) setDigits("0");
        }}
      />
    </>
  );
}
