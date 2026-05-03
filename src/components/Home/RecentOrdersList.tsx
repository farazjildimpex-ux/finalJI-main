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

const TYPE_META = {
  contract:   { icon: FileText,  bar: 'bg-blue-500',   label: 'Contract', badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
  sample:     { icon: Bookmark,  bar: 'bg-purple-500', label: 'Letter',   badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
  debit_note: { icon: Receipt,   bar: 'bg-emerald-500',label: 'Debit',    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
} as const;

const STATUS_COLORS: Record<string, string> = {
  issued:    'bg-blue-100 text-blue-800',
  inspected: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
};

function fmtDate(d: string) {
  if (!d) return '';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

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

  const getStatusColor = (status: string | null | undefined) =>
    STATUS_COLORS[(status || '').toLowerCase()] || 'bg-gray-100 text-gray-800';

  const handleStatusClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    if (openDropdown === orderId) { setOpenDropdown(null); setDropdownPosition(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setDropdownPosition({ top: rect.bottom + window.scrollY + 4, left: rect.left });
    setOpenDropdown(orderId);
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    try {
      let error;
      if (order.type === 'contract') ({ error } = await supabase.from('contracts').update({ status: newStatus }).eq('id', order.id));
      else if (order.type === 'sample') ({ error } = await supabase.from('samples').update({ status: newStatus }).eq('id', order.id));
      else if (order.type === 'debit_note') ({ error } = await supabase.from('debit_notes').update({ status: newStatus }).eq('id', order.id));
      if (error) throw error;
      onStatusChange();
    } catch (error: any) {
      dialogService.alert({ title: 'Failed to update status', message: error?.message || 'Please try again.', tone: 'danger' });
    }
    setOpenDropdown(null);
    setDropdownPosition(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setOpenDropdown(null);
    setDropdownPosition(null);
  };

  const getAvailableStatuses = (orderType: string) =>
    orderType === 'contract' ? ['Issued', 'Inspected', 'Completed'] : ['Issued', 'Completed'];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400 text-sm">
        No orders found.
      </div>
    );
  }

  const Pagination = () => totalPages > 1 ? (
    <div className="flex items-center justify-between pt-3 px-1">
      <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
        className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs text-gray-400 font-medium">
        Page {currentPage} of {totalPages} · {orders.length} total
      </span>
      <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
        className="p-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  return (
    <div>
      {/* ── Mobile card list (hidden on md+) ── */}
      <div className="md:hidden space-y-2.5">
        {currentOrders.map((order) => {
          const meta = TYPE_META[order.type as keyof typeof TYPE_META] ?? TYPE_META.contract;
          const Icon = meta.icon;
          return (
            <div
              key={`${order.type}-${order.id}`}
              onClick={() => handleOrderClick(order)}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm flex overflow-hidden active:bg-gray-50 cursor-pointer"
            >
              {/* Colored left bar */}
              <div className={`w-1 shrink-0 ${meta.bar}`} />

              <div className="flex-1 px-3.5 py-3 min-w-0">
                {/* Row 1: doc number + status */}
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="text-sm font-bold text-gray-900 truncate">{order.contractNumber}</span>
                  </div>
                  <button
                    onClick={(e) => handleStatusClick(e, order.id)}
                    className={`shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusColor(order.status)}`}
                  >
                    {order.status}<ChevronDown className="h-2.5 w-2.5" />
                  </button>
                </div>
                {/* Row 2: supplier */}
                <p className="text-xs text-gray-500 truncate mb-0.5">{order.supplierName}</p>
                {/* Row 3: type badge + date */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${meta.badge}`}>{meta.label}</span>
                  <span className="text-[10px] text-gray-400">{fmtDate(order.date)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <Pagination />
      </div>

      {/* ── Desktop table (hidden below md) ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Number','Supplier','Article','Info','Date','Status'].map(h => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentOrders.map((order) => {
                const meta = TYPE_META[order.type as keyof typeof TYPE_META] ?? TYPE_META.contract;
                const Icon = meta.icon;
                return (
                  <tr key={`${order.type}-${order.id}`} onClick={() => handleOrderClick(order)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 truncate max-w-36">{order.contractNumber}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 truncate max-w-40">{order.supplierName}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 truncate max-w-36">{order.article}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 truncate max-w-32">{order.color}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-400">{fmtDate(order.date)}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <button onClick={(e) => handleStatusClick(e, order.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)} hover:opacity-80`}>
                        {order.status}<ChevronDown className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              Showing {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, orders.length)} of {orders.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => handlePageChange(page)}
                  className={`w-7 h-7 text-xs font-semibold rounded-lg border transition-colors ${page === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {page}
                </button>
              ))}
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Status dropdown portal */}
      {openDropdown && dropdownPosition && (
        <div className="fixed z-50 w-36 bg-white rounded-xl shadow-lg border border-gray-200"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}>
          {getAvailableStatuses(orders.find(o => o.id === openDropdown)!.type).map(status => (
            <button key={status} onClick={() => handleStatusChange(orders.find(o => o.id === openDropdown)!, status)}
              className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl">
              {status}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentOrdersList;
