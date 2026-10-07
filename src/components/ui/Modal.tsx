import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from './Button';

function useLock(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
}

/** مكدّس النوافذ المفتوحة: Escape وTab يخصّان النافذة العليا فقط (مثل نافذة تأكيد فوق درج) */
const dialogStack: symbol[] = [];

function useDialogFocus(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = Symbol('dialog');
    dialogStack.push(id);
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea');
      (el ?? ref.current)?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== id) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.hasAttribute('disabled'));
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      const i = dialogStack.indexOf(id);
      if (i >= 0) dialogStack.splice(i, 1);
      prev?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  width?: number;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, width = 560, children, footer }: ModalProps) {
  useLock(open);
  const ref = useDialogFocus(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className="modal"
            style={{ '--w': `${width}px` } as CSSProperties}
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="modal-head">
              <h2>{title}</h2>
              <Button variant="ghost" icon size="sm" onClick={onClose} aria-label="إغلاق">
                <X size={18} />
              </Button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-foot">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  width?: number;
  children: ReactNode;
  actions?: ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, width = 600, children, actions }: DrawerProps) {
  useLock(open);
  const ref = useDialogFocus(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className="drawer"
            style={{ '--w': `${width}px` } as CSSProperties}
            initial={{ x: '-102%' }}
            animate={{ x: 0 }}
            exit={{ x: '-102%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 38 }}
          >
            <div className="drawer-head">
              <div className="grow">
                <h2>{title}</h2>
                {subtitle && <div className="muted small" style={{ marginTop: 2 }}>{subtitle}</div>}
              </div>
              <div className="row" style={{ gap: 6 }}>
                {actions}
                <Button variant="ghost" icon size="sm" onClick={onClose} aria-label="إغلاق">
                  <X size={18} />
                </Button>
              </div>
            </div>
            <div className="drawer-body">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, text, confirmLabel = 'تأكيد', danger, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width={440}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            تراجع
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading} data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ color: 'var(--text-2)' }}>{text}</p>
    </Modal>
  );
}
