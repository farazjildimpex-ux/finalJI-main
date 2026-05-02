import React, { useEffect, useState } from 'react';
import ContractForm from './ContractForm';
import DebitNotesSection from './DebitNotesSection';
import InvoicesSection from './InvoicesSection';
import CommunicateButton from '../Email/CommunicateButton';
import { generateContractPDF } from '../../utils/contractPdfGenerator';
import EmailLogSection from '../Email/EmailLogSection';
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
        if (data) { setSelectedContract(data); }
        else { setError('Contract not found'); navigate('/app/contracts'); }
      } catch (err) {
        console.error('Error fetching contract:', err);
        setError('Failed to load contract details');
      } finally {
        setIsLoading(false);
      }
    };

    if (location.state?.contract) { setSelectedContract(location.state.contract); }
    else if (id) { fetchContract(id); }
    else { setSelectedContract(null); }
  }, [location.state, id, navigate]);

  if (isLoading) return (
    <div className="p-4 max-w-5xl mx-auto flex items-center justify-center h-64">
      <div className="text-gray-600 text-sm">Loading contract details…</div>
    </div>
  );

  if (error) return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <p className="text-red-700 text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-5xl mx-auto space-y-4 page-fade-in">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-1">Contracts</p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {selectedContract ? selectedContract.contract_no : 'New Contract'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedContract
                ? `Contract · ${selectedContract.buyer_name || '—'}`
                : 'Create a new leather trade contract'}
            </p>
          </div>
          {selectedContract && (
            <CommunicateButton
              contextType="contract"
              contextData={selectedContract as any}
              getPdfBase64={async () => {
                const base64 = await generateContractPDF(selectedContract, true, false, undefined, false);
                return { base64, filename: `contract-${selectedContract.contract_no}.pdf` };
              }}
            />
          )}
        </div>

        <ContractForm initialContract={selectedContract} />

        {selectedContract && <InvoicesSection contractNumber={selectedContract.contract_no} />}
        {selectedContract && <DebitNotesSection contractNumber={selectedContract.contract_no} />}
        {selectedContract && <EmailLogSection contextType="contract" contextId={selectedContract.contract_no} />}
      </div>
    </div>
  );
};

export default ContractsPage;
