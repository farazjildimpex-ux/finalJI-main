import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import SampleForm from './SampleForm';
import CommunicateButton from '../Email/CommunicateButton';
import EmailLogSection from '../Email/EmailLogSection';
import { generateSamplePDF } from '../../utils/samplePdfGenerator';
import type { Sample } from '../../types';

const SampleBookPage: React.FC = () => {
  const { id } = useParams();
  const [sample, setSample] = useState<Sample | null>(null);
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
    } catch (error) {
      console.error('Error fetching sample:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-4">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {id ? 'Edit Letter' : 'New Letter'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {id ? 'Update letter details' : 'Create a new letter entry'}
          </p>
        </div>
        {sample && (
          <CommunicateButton
            contextType="letter"
            contextData={sample as any}
            getPdfBase64={async () => {
              const base64 = await generateSamplePDF(sample, null, true, false);
              return { base64, filename: `letter-${sample.sample_number}.pdf` };
            }}
          />
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm">
        <SampleForm initialData={sample} />
      </div>

      {sample && (
        <EmailLogSection contextType="letter" contextId={sample.sample_number || id || ''} />
      )}
    </div>
  );
};

export default SampleBookPage;
