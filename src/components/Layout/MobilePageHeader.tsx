import type { ReactNode } from 'react';

interface MobilePageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

const MobilePageHeader: React.FC<MobilePageHeaderProps> = ({ eyebrow, title, subtitle, action }) => (
  <div className="md:hidden mobile-page-header">
    <div className="min-w-0 flex-1">
      {eyebrow && (
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-500">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-1 text-[24px] font-black leading-tight tracking-normal text-slate-950 truncate">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-[12px] font-medium leading-5 text-slate-400 line-clamp-2">
          {subtitle}
        </p>
      )}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export default MobilePageHeader;
