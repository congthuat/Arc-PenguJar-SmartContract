"use client";

import { forwardRef, useId } from "react";

type Props = { label: string; value: string; onChange(value: string): void; describedBy?: string; autoFocus?: boolean };

export const AppLockPinInput = forwardRef<HTMLInputElement, Props>(function AppLockPinInput({ label, value, onChange, describedBy, autoFocus }, ref) {
  const id = useId();
  return <label className="app-lock-pin-field" htmlFor={id}>
    <span>{label}</span>
    <span className="app-lock-pin-control">
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        name="makoto-local-code"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
        pattern="[0-9]{6}"
        maxLength={6}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-describedby={describedBy}
        autoFocus={autoFocus}
        spellCheck={false}
      />
      <span className="app-lock-pin-mask" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index}>{index < value.length ? "●" : ""}</i>)}</span>
    </span>
  </label>;
});
