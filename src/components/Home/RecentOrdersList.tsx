import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import { FileText, Bookmark, Receipt, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

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

const RecentOrdersList: React.FC<RecentOrdersListProps> = ({ 
  orders, 
  loading,
  onStatusChange 
}) => {
  const navigate = useNavigate();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(orders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentOrders = orders.slice(startIndex, endIndex);

  const handleOrderClick = (order: Order) => {
    if (order.type === 'contract') {
      navigate(`/app/contracts/${order.id}`, { state: { contract: order.contractData } });
    } else if (order.type === 'sample') {
      navigate(`/app/samples/${order.id}`, { state: { sample: order.sampleData } });
    } else if (order.type === 'debit_note') {
      navigate(`/app/debit-notes/${order.id}`, { state: { debitNote: order.debitNoteData } });
    }
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch ((status || '').toLowerCase()) {
      case 'issued':
        return 'bg-blue-100 text-blue-800';
      case 'inspected':
        return 'bg-amber-100 text-amber-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRowColor = (order: Order) => {
    const baseColor = order.status.toLowerCase() === 'completed' ? 'bg-green-50' : '';
    let borderColor = '';
    
    if (order.type === 'sample') {
      borderColor = 'border-l-4 border-blue-400';
    } else if (order.type === 'debit_note') {
      borderColor = 'border-l-4 border-green-400';
    }
    
    return `${baseColor} ${borderColor}`;
  };

  const getOrderIcon = (type: string) => {
    switch (type) {
      case 'contract':
        return <FileText className="h-5 w-5 text-gray-500 mr-2" />;
      case 'sample':
        return <Bookmark className="h-5 w-5 text-blue-500 mr-2" />;
      case 'debit_note':
        return <Receipt className="h-5 w-5 text-green-500 mr-2" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500 mr-2" />;
    }
  };

  const handleStatusClick = (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    
    if (openDropdown === orderId) {
      setOpenDropdown(null);
      setDropdownPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left
      });
      setOpenDropdown(orderId);
    }
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    try {
      let error;
      
      if (order.type === 'contract') {
        const { error: contractError } = await supabase
          .from('contracts')
          .update({ status: newStatus })
          .eq('id', order.id);
        error = contractError;
      } else if (order.type === 'sample') {
        const { error: sampleError } = await supabase
          .from('samples')
          .update({ status: newStatus })
          .eq('id', order.id);
        error = sampleError;
      } else if (order.type === 'debit_note') {
        const { error: debitNoteError } = await supabase
          .from('debit_notes')
          .update({ status: newStatus })
          .eq('id', order.id);
        error = debitNoteError;
      }

      if (error) throw error;
      onStatusChange();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status');
    }
    setOpenDropdown(null);
    setDropdownPosition(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setOpenDropdown(null);
    setDropdownPosition(null);
  };

  const getAvailableStatuses = (orderType: string) => {
    if (orderType === 'contract') {
      return ['Issued', 'Inspected', 'Completed'];
    } else {
      return ['Issued', 'Completed'];
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        No orders found matching your search criteria.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Table with horizontal scrolling */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Number
              </th>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Supplier
              </th>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Article
              </th>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Color
              </th>
              <th scope="col" className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentOrders.map((order) => (
              <tr 
                key={`${order.type}-${order.id}`}
                onClick={() => handleOrderClick(order)}
                className={`hover:bg-blue-50 cursor-pointer transition-colors duration-150 ${getRowColor(order)}`}
              >
                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex items-center">
                    {getOrderIcon(order.type)}
                    <span className="truncate max-w-32 md:max-w-none">{order.contractNumber}</span>
                  </div>
                </td>
                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="truncate max-w-32 md:max-w-none block">{order.supplierName}</span>
                </td>
                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="truncate max-w-32 md:max-w-none block">{order.article}</span>
                </td>
                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="truncate max-w-32 md:max-w-none block">{order.color}</span>
                </td>
                <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="relative">
                    <button
                      onClick={(e) => handleStatusClick(e, order.id)}
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)} hover:opacity-80 transition-opacity`}
                    >
                      {order.status}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Dropdown - Moved outside the scrolling container */}
      {openDropdown && dropdownPosition && (
        <div 
          className="fixed z-10 w-32 bg-white rounded-md shadow-lg border border-gray-200"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          <div className="py-1">
            {getAvailableStatuses(orders.find(o => o.id === openDropdown)!.type).map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(orders.find(o => o.id === openDropdown)!, status)}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, orders.length)}</span> of{' '}
                <span className="font-medium">{orders.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === currentPage
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecentOrdersList;