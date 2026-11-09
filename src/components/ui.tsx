"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { X } from "lucide-react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "normal" | "small";
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "normal",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`button button-${variant} button-${size} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  className = "",
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={`modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="إغلاق" onClick={onClose}><X size={18} /></IconButton>
        </div>
        {children}
      </section>
    </div>
  );
}

export function StatusBadge({ children }: { children: string }) {
  const kind =
    children === "نشط" || children === "تم الدفع" || children === "حاضر" || children === "مفعّل"
      ? "success"
      : children === "قارب على الانتهاء" || children === "معلّق" || children === "تجريبي"
        ? "warning"
        : children === "منتهي" || children === "متأخر" || children === "موقوف"
          ? "danger"
          : "neutral";

  return <span className={`status-badge status-${kind}`}>{children}</span>;
}

export function Avatar({ initials, color = "mint" }: { initials: string; color?: string }) {
  return <span className={`avatar avatar-${color}`}>{initials}</span>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state-mark">—</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function ToastMessage({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="toast" role="status">
      <span className="toast-check">✓</span>
      <span>{message}</span>
      <IconButton label="إغلاق الإشعار" onClick={onClose}><X size={15} /></IconButton>
    </div>
  );
}
