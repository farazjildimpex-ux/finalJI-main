import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { FileText, Bookmark, Receipt, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { dialogService } from '../../lib/dialogService';

interface RecentOrdersListProps {
  orders: Order[];
  loading: boolean;
  onStatusChange: () => void;
}

interface DropdownPosition {
  top: number;
  left: number;
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

const TYPE_LABEL: Record<string, string> = {
  contract: 'Contract',
  sample: 'Letter',
  debit_note: 'Payment',
};

const RecentOrdersList: React.FC<RecentOrdersListProps> = ({ orders, loading, onStatusChange }) => {
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
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

  const handleStatusClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (openDropdown === orderId) { setOpenDropdown(null); setDropdownPosition(null); }
    else {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left });
      setOpenDropdown(orderId);
    }
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    try {
      let error;
      if (order.type === 'contract')   ({ error } = await supabase.from('contracts').update({ status: newStatus }).eq('id', order.id));
      else if (order.type === 'sample') ({ error } = await supabase.from('samples').update({ status: newStatus }).eq('id', order.id));
      else if (order.type === 'debit_note') ({ error } = await supabase.from('debit_notes').update({ status: newStatus }).eq('id', order.id));
      if (error) throw error;
      onStatusChange();
    } catch (error: any) {
      console.error('Error updating status:', error);
      dialogService.alert({ title: 'Failed to update status', message: error?.message || 'Please try again.', tone: 'danger' });
    }
    setOpenDropdown(null); setDropdownPosition(null);
  };

  const getAvailableStatuses = (orderType: string) =>
    orderType === 'contract' ? ['Issued', 'Inspected', 'Completed'] : ['Issued', 'Completed'];

  const getOrderIcon = (type: string) => {
    const style = TYPE_STYLES[type] || TYPE_STYLES.contract;
    if (type === 'contract')  return <FileText className={`h-4 w-4 ${style.icon}`} />;
    if (type === 'sample')    return <Bookmark className={`h-4 w-4 ${style.icon}`} />;
    if (type === 'debit_note') return <Receipt className={`h-4 w-4 ${style.icon}`} />;
    return <FileText className="h-4 w-4 text-gray-400" />;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">
        No records found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
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
                  key={`${order.type}-${order.id}`}
                  onClick={() => handleOrderClick(order)}
                  className={`cursor-pointer transition-colors duration-100 ${ts.row}`}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getOrderIcon(order.type)}
                      <div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${ts.badge} mr-1`}>
                          {TYPE_LABEL[order.type] || order.type}
                        </span>
                        <span className="text-[12px] font-semibold text-gray-800 truncate max-w-[100px] inline-block align-middle">
                          {order.contractNumber}
                        </span>
                      </div>
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
                      onClick={(e) => handleStatusClick(e, order.id)}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${getStatusColor(order.status)} hover:opacity-80 transition-opacity`}
                    >
                      {order.status}
                      <ChevronDown className="h-2.5 w-2.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Status dropdown */}
      {openDropdown && dropdownPosition && (
        <div className="fixed z-50 w-32 bg-white rounded-lg shadow-lg border border-gray-200"
             style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
          <div className="py-1">
            {getAvailableStatuses(orders.find(o => o.id === openDropdown)!.type).map((status) => (
              <button key={status} onClick={() => handleStatusChange(orders.find(o => o.id === openDropdown)!, status)}
                className="block w-full text-left px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50">
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
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
  );
};

export default RecentOrdersList;
