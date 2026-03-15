interface SectionHeadingProps {
  title: string;
  action?: React.ReactNode;
}

export function SectionHeading({ title, action }: SectionHeadingProps) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 className="text-[0.75rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {title}
      </h2>
      {action}
    </div>
  );
}
