import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: string;
  onClose: () => void;
}

export default function Toast({ message, type = 'default', onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg =
    type === 'success' ? 'bg-emerald-600' :
    type === 'error'   ? 'bg-red-600'     :
                         'bg-gray-900';

  return (
    <div className={`fixed bottom-6 right-6 ${bg} text-white px-5 py-3 rounded-lg text-sm z-50 animate-fade-in shadow-lg`}>
      {message}
    </div>
  );
}
