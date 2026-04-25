import React, { useEffect, useState } from 'react';
import ContractForm from './ContractForm';
import DebitNotesSection from './DebitNotesSection';
import InvoicesSection from './InvoicesSection';
import { FileText } from 'lucide-react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import type { Contract } from '../../types';
import { supabase } from '../../lib/supabaseClient';

const ContractsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to top when component mounts
    window.scrollTo(0, 0);
    
    const fetchContract = async (contractId: string) => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error } = await supabase
          .from('contracts')
          .select('*')
          .eq('id', contractId)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setSelectedContract(data);
        } else {
          setError('Contract not found');
          // Optionally navigate back or to a 404 page
          navigate('/app/contracts');
        }
      } catch (err) {
        console.error('Error fetching contract:', err);
        setError('Failed to load contract details');
      } finally {
        setIsLoading(false);
      }
    };

    // First check location state for contract data
    if (location.state?.contract) {
      setSelectedContract(location.state.contract);
    }
    // If no contract in state but we have an ID in URL, fetch from Supabase
    else if (id) {
      fetchContract(id);
    }
    // Reset selected contract if neither exists
    else {
      setSelectedContract(null);
    }
  }, [location.state, id, navigate]);

  if (isLoading) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading contract details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-3 max-w-5xl mx-auto space-y-4 page-fade-in">
      <div className="mb-4 md:mb-6 flex flex-col items-center text-center">
        <div className="flex items-center justify-center mb-2">
          <FileText className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mr-2" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {selectedContract ? 'Edit Contract' : 'New Contract'}
          </h1>
        </div>
        <p className="text-xs md:text-sm text-gray-600">
          {selectedContract 
            ? `Editing contract ${selectedContract.contract_no}`
            : 'Create a new contract with detailed specifications'
          }
        </p>
      </div>

      {/* Contract Form Section */}
      <div className="bg-white rounded-lg shadow-lg p-2 md:p-3">
        <ContractForm initialContract={selectedContract} />
      </div>

      {/* Invoices and Shipping Details - Only show if we have a selected contract */}
      {selectedContract && (
        <InvoicesSection contractNumber={selectedContract.contract_no} />
      )}

      {/* Debit Notes Section - Only show if we have a selected contract */}
      {selectedContract && (
        <DebitNotesSection contractNumber={selectedContract.contract_no} />
      )}
    </div>
  );
}

export default ContractsPage;