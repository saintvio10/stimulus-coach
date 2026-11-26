export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <rect width="512" height="512" rx="112" fill="rgb(var(--raised))" />
      <path d="M118 300c40-6 62-60 92-60s38 70 74 70 50-128 86-128c18 0 28 14 34 30" fill="none" stroke="rgb(var(--accent))" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="404" cy="212" r="22" fill="rgb(var(--rec-green))" />
    </svg>
  );
}
