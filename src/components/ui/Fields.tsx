import { forwardRef, useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Search, X } from 'lucide-react';
import { fmtNum, parseNum } from '../../lib/format';

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, error, className = '', children }: FieldProps) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {children(id)}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function TextInput({ invalid, className = '', ...p }, ref) {
  return <input ref={ref} {...p} className={`input ${invalid ? 'invalid' : ''} ${className}`} />;
});

export function SelectInput({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={`select ${className}`}>
      {children}
    </select>
  );
}

export function TextArea({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`textarea ${className}`} />;
}

interface NumProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  decimals?: number;
  invalid?: boolean;
}

/** حقل رقمي يقبل الأرقام العربية ويحافظ على نص الكتابة (مثل "12.") أثناء الإدخال */
export function NumInput({ value, onChange, suffix, decimals = 2, invalid, className = '', ...p }: NumProps) {
  const [text, setText] = useState(value === 0 ? '' : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused && parseNum(text) !== value) setText(value === 0 ? '' : String(value));
  }, [value, focused, text]);
  return (
    <div className={`input-affix ${suffix ? 'has-suffix' : ''}`}>
      <input
        {...p}
        inputMode="decimal"
        dir="ltr"
        className={`input ${invalid ? 'invalid' : ''} ${className}`}
        // dir=ltr يعكس الحشو المنطقي، فنحدده فيزيائيًا: الرقم يمين الحقل واللاحقة (ر.س/يوم) يساره
        style={{ textAlign: 'right', paddingLeft: suffix ? '3.8rem' : '0.9rem', paddingRight: '0.9rem' }}
        value={text}
        placeholder={p.placeholder ?? '0'}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setText(value === 0 ? '' : fmtNum(value, Number.isInteger(value) ? 0 : decimals).replace(/,/g, ''));
        }}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^[\d٠-٩۰-۹.,٫]*$/.test(raw)) return;
          setText(raw);
          onChange(parseNum(raw));
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'بحث…', className = '', autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={`input-affix ${className}`}>
      <Search size={18} />
      <input className="input" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label={placeholder} />
      {value && (
        <button type="button" className="btn ghost icon sm" onClick={() => onChange('')} aria-label="مسح" style={{ position: 'absolute', insetInlineEnd: 6, top: 5 }}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

interface SegProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  name: string;
}

/** تحكم مقطعي مع مؤشر متحرك */
export function Segmented<T extends string>({ value, onChange, options, name }: SegProps<T>) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {value === o.value && <motion.span layoutId={`seg-${name}`} className="pill" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
          <span>
            {o.label}
            {o.count !== undefined && <span className="count">{o.count}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options, name }: SegProps<T>) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
          {o.count !== undefined && <span className="count" style={{ marginInlineStart: 6 }}>{o.count}</span>}
          {value === o.value && <motion.span layoutId={`tab-${name}`} className="underline" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        </button>
      ))}
    </div>
  );
}

export function QtyStepper({ value, onChange, min = 0, max = 99999, ariaLabel }: { value: number; onChange: (n: number) => void; min?: number; max?: number; ariaLabel?: string }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.floor(n)));
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="زيادة">
        <Plus size={16} />
      </button>
      <input inputMode="numeric" value={value} aria-label={ariaLabel ?? 'الكمية'} onChange={(e) => onChange(clamp(parseNum(e.target.value)))} onFocus={(e) => e.target.select()} />
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="إنقاص">
        <Minus size={16} />
      </button>
    </div>
  );
}
