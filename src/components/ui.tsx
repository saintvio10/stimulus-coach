import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import type { RecoveryColor } from '../lib/muscles';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ className, variant = 'secondary', size = 'md', ...p }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'bg-fg text-bg hover:bg-white',
        variant === 'secondary' && 'bg-raised text-fg hover:bg-[rgb(36_36_42)]',
        variant === 'ghost' && 'text-muted hover:bg-raised hover:text-fg',
        variant === 'outline' && 'border border-line/10 text-fg hover:bg-raised',
        variant === 'danger' && 'bg-rec-red/15 text-rec-red hover:bg-rec-red/25',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[15px]',
        size === 'icon' && 'h-9 w-9',
        className,
      )}
      {...p}
    />
  ),
);
Button.displayName = 'Button';

export function Card({ className, children, ...p }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('card min-w-0 p-4 sm:p-5', className)} {...p}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-[15px] font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Badge({ children, tone = 'default', className }: { children: ReactNode; tone?: 'default' | 'accent' | RecoveryColor; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        tone === 'default' && 'bg-raised text-muted',
        tone === 'accent' && 'bg-accent/15 text-accent',
        tone === 'green' && 'bg-rec-green/15 text-rec-green',
        tone === 'yellow' && 'bg-rec-yellow/15 text-rec-yellow',
        tone === 'orange' && 'bg-rec-orange/15 text-rec-orange',
        tone === 'red' && 'bg-rec-red/15 text-rec-red',
        tone === 'gray' && 'bg-raised text-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => (
  <input
    ref={ref}
    className={cn(
      'h-10 w-full rounded-xl border border-line/10 bg-bg px-3 text-[15px] text-fg placeholder:text-muted/60 focus:border-accent/60 focus:outline-none',
      className,
    )}
    {...p}
  />
));
Input.displayName = 'Input';

export function Field({ label, children, hint, className }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-[12px] font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted/80">{hint}</span>}
    </label>
  );
}

export function Select({ className, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn('h-10 w-full rounded-xl border border-line/10 bg-bg px-3 text-[15px] text-fg focus:border-accent/60 focus:outline-none', className)}
      {...p}
    />
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-10 shrink-0 rounded-full transition', checked ? 'bg-accent' : 'bg-raised')}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn('scroll-x inline-flex max-w-full rounded-full bg-raised p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition',
            value === o.value ? 'bg-fg text-bg' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition active:scale-[0.97]',
        active ? 'border-accent/50 bg-accent/15 text-fg' : 'border-line/10 text-muted hover:border-line/20 hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', k);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full animate-sheet-up flex-col rounded-t-[1.5rem] border border-line/10 bg-surface sm:animate-fade-up sm:rounded-[1.5rem]',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0 text-[17px] font-semibold">{title}</div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="safe-b border-t border-line/10 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Kreisförmige Fortschrittsanzeige */
export function Ring({
  value,
  size = 72,
  stroke = 7,
  color = 'rgb(var(--accent))',
  children,
}: {
  value: number; // 0–1
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--raised))" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

export function Bar({ value, color = 'rgb(var(--accent))', className, marker }: { value: number; color?: string; className?: string; marker?: number }) {
  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-raised', className)}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      {marker != null && <div className="absolute top-0 h-full w-px bg-fg/50" style={{ left: `${Math.min(1, marker) * 100}%` }} />}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="label">{label}</div>
      <div className="tnum mt-1 text-[22px] font-semibold leading-none tracking-tight">{value}</div>
      {sub && <div className="mt-1 truncate text-[12px] text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <div className="font-medium">{title}</div>
      {text && <p className="max-w-sm text-[13px] text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 pt-2">
      <div className="min-w-0">
        {sub && <div className="label mb-1">{sub}</div>}
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel = 'Bestätigen',
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text?: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {text && <p className="text-sm text-muted">{text}</p>}
    </Sheet>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+12px)] z-[60] flex justify-center px-4">
      <div className="animate-fade-up rounded-full border border-line/10 bg-raised px-4 py-2 text-sm shadow-xl">{message}</div>
    </div>,
    document.body,
  );
}

/** Breiter Fortschrittsbalken mit grünem Verlauf und Beschriftung im Balken */
export function GlowProgress({ value, label, className, height = 44, children }: { value: number; label?: ReactNode; className?: string; height?: number; children?: ReactNode }) {
  const v = Math.max(0, Math.min(1, value));
  const onFill = v > 0.62; // Text liegt auf dem hellen Ende des Verlaufs
  return (
    <div className={cn('relative w-full overflow-hidden rounded-full bg-[rgb(var(--raised))]', className)} style={{ height }}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `max(${height}px, ${v * 100}%)`,
          background: 'linear-gradient(90deg, #0b8f5a 0%, #22c47e 32%, #6ee7a8 64%, #ecfff4 100%)',
          boxShadow: '0 0 22px rgba(61, 220, 151, 0.35), inset 0 1px 0 rgba(255,255,255,0.35)',
        }}
      />
      {label != null && (
        <span
          className={cn(
            'tnum pointer-events-none absolute inset-y-0 right-4 flex items-center whitespace-nowrap font-medium',
            height < 36 ? 'text-[12.5px]' : 'text-[14.5px]',
            onFill ? 'text-[#0d3b26]' : 'text-muted',
          )}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
