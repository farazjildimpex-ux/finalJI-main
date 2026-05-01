import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import DebitNoteForm from './DebitNoteForm';
import EmailButton from '../Email/EmailButton';
import EmailLogSection from '../Email/EmailLogSection';
import type { DebitNote } from '../../types';

const DebitNotePage: React.FC = () => {
  const { id } = useParams();
  const [debitNote, setDebitNote] = useState<DebitNote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    if (id) {
      fetchDebitNote(id);
    }
  }, [id]);

  const fetchDebitNote = async (debitNoteId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('debit_notes')
        .select('*')
        .eq('id', debitNoteId)
        .single();

      if (error) throw error;
      setDebitNote(data);
    } catch (error) {
      console.error('Error fetching payment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-3 max-w-5xl mx-auto page-fade-in">
      <div className="mb-4 md:mb-6 flex flex-col items-center text-center">
        <div className="flex items-center justify-center mb-2">
          <Receipt className="h-6 w-6 md:h-8 md:w-8 text-green-600 mr-2" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {id ? 'Edit Payment' : 'New Payment'}
          </h1>
        </div>
        <p className="text-xs md:text-sm text-gray-600">
          {id ? 'Update payment details' : 'Create a new payment entry'}
        </p>
        {debitNote && (
          <div className="mt-3">
            <EmailButton contextType="payment" contextData={debitNote as any} />
          </div>
        )}
      </div>
      <DebitNoteForm initialData={debitNote} />
      {debitNote && (
        <EmailLogSection contextType="payment" contextId={debitNote.id} />
      )}
    </div>
  );
};

export default DebitNotePage;