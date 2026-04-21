'use client';

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-4 pl-16 md:px-8 md:py-5 md:pl-8">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-slate-900 md:text-xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 md:text-sm">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}
