"use client";

type SuccessConfirmationProps = {
  open: boolean;
  title?: string;
  message?: string;
  onClose: () => void;
};

export function SuccessConfirmation({
  open,
  title = "Berhasil disimpan!",
  message = "Perubahan turnamen telah tersimpan.",
  onClose,
}: SuccessConfirmationProps) {
  if (!open) return null;

  return (
    <div className="success-overlay" role="dialog" aria-modal="true" aria-labelledby="success-title">
      <button
        type="button"
        className="success-backdrop"
        aria-label="Tutup"
        onClick={onClose}
      />
      <div className="success-dialog panel">
        <div className="success-visual" aria-hidden>
          <span className="success-confetti success-confetti-1" />
          <span className="success-confetti success-confetti-2" />
          <span className="success-confetti success-confetti-3" />
          <span className="success-confetti success-confetti-4" />
          <span className="success-confetti success-confetti-5" />
          <span className="success-confetti success-confetti-6" />
          <div className="success-ring">
            <svg
              className="success-check"
              viewBox="0 0 52 52"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="26" cy="26" r="24" stroke="currentColor" strokeWidth="3" />
              <path
                d="M14 27.5L22.5 36L38 18"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h2 id="success-title" className="success-title">
          {title}
        </h2>
        <p className="success-message">{message}</p>
        <button type="button" className="btn-primary success-btn" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
}
