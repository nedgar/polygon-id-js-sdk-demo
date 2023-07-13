import type { ReactNode, Ref} from "react";
import { forwardRef } from "react";

interface Props {
  title: ReactNode;
  className?: string;
  children?: ReactNode;
}

export const Section = forwardRef(function Section({ title, className, children }: Props, ref?: Ref<HTMLElement>) {
  return (
    <section className={`rounded-md ${className}`} ref={ref}>
      <h2 className="bg-gray-200 px-4 py-2 text-lg font-bold">{title}</h2>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
});
