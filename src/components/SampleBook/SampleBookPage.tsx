import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import SampleForm from './SampleForm';
import CommunicateButton from '../Email/CommunicateButton';
import EmailLogSection from '../Email/EmailLogSection';
import { generateSamplePDF } from '../../utils/samplePdfGenerator';
import { loadCompanyLetterheadImages } from '../../utils/pdfLayoutConfig';
import type { Sample, Company } from '../../types';

const SampleBookPage: React.FC = () => {
  const { id } = useParams();
  const [sample, setSample]   = useState<Sample | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) fetchSample(id);
  }, [id]);

  const fetchSample = async (sampleId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('samples').select('*').eq('id', sampleId).single();
      if (error) throw error;
      setSample(data);
      if (data?.company_name) {
        const { data: co } = await supabase.from('companies').select('*').eq('name', data.company_name).maybeSingle();
        if (co) setCompany(co as Company);
      }
    } catch (error) {
      console.error('Error fetching sample:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-5xl mx-auto space-y-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-500 mb-1">Sample Letters</p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {sample ? sample.sample_number : 'New Letter'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {sample ? `Letter · ${sample.supplier_name || '—'}` : 'Create a new sample / cover letter'}
            </p>
          </div>
          {sample && (
            <CommunicateButton
              contextType="letter"
              contextData={sample as any}
              getPdfBase64={async () => {
                let letterheadImages: { headerBase64: string | null; footerBase64: string | null; headerExt?: string; footerExt?: string } | undefined;
                if (company?.header_url || company?.footer_url) {
                  const imgs = await loadCompanyLetterheadImages(company);
                  if (imgs.headerBase64 || imgs.footerBase64) letterheadImages = imgs;
                }
                const base64 = await generateSamplePDF(sample, company, true, false, letterheadImages);
                return { base64, filename: `letter-${sample.sample_number}.pdf` };
              }}
            />
          )}
        </div>

        <SampleForm initialData={sample} />

        {sample && (
          <EmailLogSection contextType="letter" contextId={sample.sample_number || id || ''} />
        )}
      </div>
    </div>
  );
};

export default SampleBookPage;
