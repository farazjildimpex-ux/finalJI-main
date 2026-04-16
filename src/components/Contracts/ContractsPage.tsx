import React, { useEffect, useState } from 'react';
import ContractForm from './ContractForm';
import DebitNotesSection from './DebitNotesSection';
import FileUploadSection from './FileUploadSection';
import { FileText, ArrowLeft, ShieldCheck } from 'lucide-react';
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
        
        if (data) {
          setSelectedContract(data);
        } else {
          setError('Contract not found');
          navigate('/app/home');
        }
      } catch (err) {
        console.error('Error fetching contract:', err);
        setError('Failed to load contract details');
      } finally {
        setIsLoading(false);
      }
    };

    if (location.state?.contract) {
      setSelectedContract(location.state.contract);
    } else if (id) {
      fetchContract(id);
    } else {
      setSelectedContract(null);
    }
  }, [location.state, id, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 pb-12 page-fade-in">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/app/home')}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {selectedContract ? `Contract ${selectedContract.contract_no}` : 'New Contract'}
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {selectedContract ? 'Editing Record' : 'Drafting New Record'}
                </span>
                {selectedContract?.status === 'Completed' && (
                  <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                    <ShieldCheck className="h-2.5 w-2.5" /> Verified
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 p-2 bg-blue-50 rounded-2xl">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-bold">{error}</p>
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <ContractForm initialContract={selectedContract} />
          </div>
        </div>

        {/* Secondary Sections */}
        {selectedContract && (
          <div className="grid grid-cols-1 gap-8">
            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Documents & Attachments</h3>
              </div>
              <div className="p-6 md:p-8">
                <FileUploadSection 
                  contractId={selectedContract.id} 
                  contractNumber={selectedContract.contract_no} 
                />
              </div>
            </div>

            <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Financials & Debit Notes</h3>
              </div>
              <div className="p-6 md:p-8">
                <DebitNotesSection contractNumber={selectedContract.contract_no} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContractsPage;