import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Section({ title, className, children }: Props) {
  return (
    <section className={`rounded-md ${className}`}>
      <h2 className="bg-gray-200 px-4 py-2 text-lg font-bold">{title}</h2>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
