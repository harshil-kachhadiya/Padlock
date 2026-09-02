import { HTMLAttributes } from "react";

export function PageContainer({
  className = "",
  children,
  id = "main",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <main
      id={id}
      className={`mx-auto w-full max-w-5xl px-4 py-10 sm:px-8 ${className}`}
      {...rest}
    >
      {children}
    </main>
  );
}
