import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'soft' | 'ghost' | 'danger' | 'success' | 'wa';
  size?: 'sm' | 'md' | 'lg';
  icon?: boolean;
  block?: boolean;
  loading?: boolean;
  leading?: ReactNode;
}

export function Button({ variant = 'default', size = 'md', icon, block, loading, leading, className = '', children, disabled, type = 'button', ...rest }: Props) {
  const cls = ['btn', variant !== 'default' && variant, size !== 'md' && size, icon && 'icon', block && 'block', className].filter(Boolean).join(' ');
  return (
    <button {...rest} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined}>
      {loading ? <span className="spinner" aria-hidden /> : leading}
      {children}
    </button>
  );
}
