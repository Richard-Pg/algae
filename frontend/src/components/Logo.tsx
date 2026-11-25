export function LogoMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="10" r="2.6" fill="currentColor" />
      <circle cx="15" cy="9" r="1.8" fill="currentColor" />
      <circle cx="14" cy="15" r="2.2" fill="currentColor" />
    </svg>
  );
}
