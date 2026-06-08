import React from 'react';
import { X } from 'lucide-react';
import type { Order } from '../../types';
import { getAvailableStatuses } from '../../utils/orderStatus';

const STATUS_COLORS: Record<string, string> = {
  Issued:    'bg-blue-50 text-blue-700 border-blue-200 ring-blue-100',
  Inspected: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-100',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100',
  Cancelled: 'bg-red-50 text-red-700 border-red-200 ring-red-100',
};

interface StatusChangePopupProps {
  order: Order;
  onClose: () => void;
  onSelect: (status: string) => void;
}

const StatusChangePopup: React.FC<StatusChangePopupProps> = ({ order, onClose, onSelect }) => {
  const options = getAvailableStatuses(order.type);

  const typeLabel = order.type === 'contract' ? 'Contract' : order.type === 'sample' ? 'Letter' : 'Payment';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.18s ease-out' }}
      >
        <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{typeLabel}</p>
            <p className="text-base font-bold text-gray-900 truncate mt-0.5">{order.contractNumber}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{order.supplierName}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <p className="text-xs font-semibold text-gray-500 mb-3">Change status to</p>
          {options.map(status => {
            const isCurrent = (order.status || '').toLowerCase() === status.toLowerCase();
            return (
              <button
                key={status}
                onClick={() => { if (!isCurrent) onSelect(status); else onClose(); }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-sm font-bold transition-all active:scale-[0.98] ${
                  isCurrent
                    ? `${STATUS_COLORS[status]} ring-2`
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {status}
                {isCurrent && <span className="text-[10px] font-semibold opacity-70">Current</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StatusChangePopup;
