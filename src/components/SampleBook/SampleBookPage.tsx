import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bookmark } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import SampleForm from './SampleForm';
import type { Sample } from '../../types';

const SampleBookPage: React.FC = () => {
  const { id } = useParams();
  const [sample, setSample] = useState<Sample | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchSample(id);
    }
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

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-3 max-w-5xl mx-auto">
      <div className="mb-4 md:mb-6 flex flex-col items-center text-center">
        <div className="flex items-center justify-center mb-2">
          <Bookmark className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mr-2" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {id ? 'Edit Letter' : 'New Letter'}
          </h1>
        </div>
        <p className="text-xs md:text-sm text-gray-600">
          {id ? 'Update letter details' : 'Create a new letter entry'}
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-2 md:p-3 shadow-sm">
        <SampleForm initialData={sample} />
      </div>
    </div>
  );
};

export default SampleBookPage;