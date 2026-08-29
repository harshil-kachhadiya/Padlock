"use client";

import { InputHTMLAttributes, forwardRef, useId, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ label, hint, id, className = "", ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="mb-4">
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-foreground">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            className={`w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-muted focus:border-navy-700 focus:ring-2 focus:ring-navy-700/30 ${className}`}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            className="flex-shrink-0 rounded-sm border border-border bg-surface px-3 text-xs font-semibold text-foreground-muted transition-colors hover:text-foreground"
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        {hint && <p className="mt-1 text-xs text-foreground-muted">{hint}</p>}
      </div>
    );
  }
);
