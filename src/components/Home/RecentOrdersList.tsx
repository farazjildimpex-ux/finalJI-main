import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../types';
import { FileText, Bookmark, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { dialogService } from '../../lib/dialogService';
import StatusChangePopup from '../UI/StatusChangePopup';
import { orderKey, updateOrderStatus } from '../../utils/orderStatus';

interface RecentOrdersListProps {
  orders: Order[];
  loading: boolean;
  onStatusChange: () => void;
  embedded?: boolean;
}

const ITEMS_PER_PAGE = 15;

const TYPE_STYLES: Record<string, { row: string; badge: string; icon: string }> = {
  contract: {
    row: 'border-l-4 border-l-indigo-400 hover:bg-indigo-50/40',
    badge: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
    icon: 'text-indigo-500',
  },
  sample: {
    row: 'border-l-4 border-l-blue-400 hover:bg-blue-50/40',
    badge: 'bg-blue-50 text-blue-700 border border-blue-100',
    icon: 'text-blue-500',
  },
  debit_note: {
    row: 'border-l-4 border-l-emerald-400 hover:bg-emerald-50/40',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    icon: 'text-emerald-500',
  },
};

const RecentOrdersList: React.FC<RecentOrdersListProps> = ({ orders, loading, onStatusChange, embedded = false }) => {
  const navigate = useNavigate();
  const [statusPopupOrder, setStatusPopupOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentOrders = orders.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleOrderClick = (order: Order) => {
    if (order.type === 'contract') navigate(`/app/contracts/${order.id}`, { state: { contract: order.contractData } });
    else if (order.type === 'sample') navigate(`/app/samples/${order.id}`, { state: { sample: order.sampleData } });
    else if (order.type === 'debit_note') navigate(`/app/debit-notes/${order.id}`, { state: { debitNote: order.debitNoteData } });
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch ((status || '').toLowerCase()) {
      case 'issued':    return 'bg-blue-100 text-blue-800';
      case 'inspected': return 'bg-amber-100 text-amber-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default:          return 'bg-gray-100 text-gray-700';
    }
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    try {
      await updateOrderStatus(order, newStatus);
      onStatusChange();
      setStatusPopupOrder(null);
    } catch (error: any) {
      console.error('Error updating status:', error);
      dialogService.alert({ title: 'Failed to update status', message: error?.message || 'Please try again.', tone: 'danger' });
    }
  };

  const getOrderIcon = (type: string) => {
    const style = TYPE_STYLES[type] || TYPE_STYLES.contract;
    if (type === 'contract')  return <FileText className={`h-4 w-4 ${style.icon}`} />;
    if (type === 'sample')    return <Bookmark className={`h-4 w-4 ${style.icon}`} />;
    if (type === 'debit_note') return <Receipt className={`h-4 w-4 ${style.icon}`} />;
    return <FileText className="h-4 w-4 text-gray-400" />;
  };

  const shellCls = embedded
    ? 'overflow-hidden'
    : 'bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm';

  if (loading) {
    return (
      <div className={`${embedded ? 'p-6' : 'bg-white rounded-xl border border-gray-200 p-6'} flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={`${embedded ? 'p-6' : 'bg-white rounded-xl border border-gray-200 p-6'} text-center text-sm text-gray-400`}>
        No records found.
      </div>
    );
  }

  return (
    <>
      <div className={shellCls}>
        <div className="overflow-x-auto no-scrollbar">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Type / Number</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Supplier</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Article</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Color / Ref</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentOrders.map((order) => {
                const ts = TYPE_STYLES[order.type] || TYPE_STYLES.contract;
                return (
                  <tr
                    key={orderKey(order)}
                    onClick={() => handleOrderClick(order)}
                    className={`cursor-pointer transition-colors duration-100 ${ts.row}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getOrderIcon(order.type)}
                        <span className="text-[12px] font-semibold text-gray-800 truncate max-w-[120px]">
                          {order.contractNumber}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[12px] text-gray-600 truncate max-w-[120px] block">{order.supplierName}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[12px] text-gray-500 truncate max-w-[120px] block">{order.article}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[12px] text-gray-500 truncate max-w-[100px] block">{order.color}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatusPopupOrder(order); }}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(order.status)} hover:opacity-80 transition-opacity`}
                      >
                        {order.status}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-2.5 flex items-center justify-between border-t border-gray-100 bg-gray-50">
            <p className="text-[11px] text-gray-400">
              {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, orders.length)} of {orders.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded text-[11px] font-semibold ${currentPage === page ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {page}
                </button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {statusPopupOrder && (
        <StatusChangePopup
          order={statusPopupOrder}
          onClose={() => setStatusPopupOrder(null)}
          onSelect={(status) => handleStatusChange(statusPopupOrder, status)}
        />
      )}
    </>
  );
};

export default RecentOrdersList;
