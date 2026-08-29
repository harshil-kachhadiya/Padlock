type AlertProps = {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
};

const VARIANT_CLASSES = {
  error: "border-red-600 bg-red-50 text-red-600",
  success: "border-green-700 bg-green-50 text-green-700",
  info: "border-navy-700 bg-navy-700/5 text-navy-800 dark:text-gray-100",
};

export function Alert({ variant = "info", children }: AlertProps) {
  return (
    <div
      role="alert"
      className={`mb-4 rounded-sm border-l-4 px-4 py-3 text-sm ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </div>
  );
}
