import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  widthClassName?: string;
}

export default function Modal({ open, title, children, onClose, widthClassName = 'max-w-[540px]' }: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4 py-4 sm:px-6 sm:py-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`w-full ${widthClassName} bg-white rounded-2xl shadow-xl border border-gray-200 max-h-[calc(100vh-2rem)] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <h2 className="section-heading mb-0">{title}</h2>
          <button className="btn-ghost text-gray-500" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
