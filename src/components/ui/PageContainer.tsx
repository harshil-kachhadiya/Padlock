import { HTMLAttributes } from "react";

export function PageContainer({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <main className={`mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 ${className}`} {...rest}>
      {children}
    </main>
  );
}
