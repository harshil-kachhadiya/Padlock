import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-navy-800 text-white border border-navy-900 hover:bg-navy-700 focus-visible:outline-gold-500 disabled:bg-gray-400 disabled:border-gray-400",
  secondary:
    "bg-surface text-foreground border border-border hover:bg-surface-muted focus-visible:outline-navy-700 disabled:text-gray-400",
  danger:
    "bg-red-600 text-white border border-red-600 hover:opacity-90 focus-visible:outline-red-600 disabled:bg-gray-400 disabled:border-gray-400",
  ghost:
    "bg-transparent text-navy-800 dark:text-gold-500 border border-transparent hover:bg-navy-800/5 focus-visible:outline-navy-700",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", disabled, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-semibold tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
