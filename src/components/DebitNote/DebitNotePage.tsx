import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import DebitNoteForm from './DebitNoteForm';
import CommunicateButton from '../Email/CommunicateButton';
import EmailLogSection from '../Email/EmailLogSection';
import { generateDebitNotePDF } from '../../utils/debitNotePdfGenerator';
import type { DebitNote } from '../../types';

const DebitNotePage: React.FC = () => {
  const { id } = useParams();
  const [debitNote, setDebitNote] = useState<DebitNote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (id) fetchDebitNote(id);
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

  if (loading) return (
    <div className="p-4 flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  );

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto space-y-4 page-fade-in">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {id ? 'Edit Payment' : 'New Payment'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {id ? 'Update payment details' : 'Create a new payment entry'}
          </p>
        </div>
        {debitNote && (
          <CommunicateButton
            contextType="payment"
            contextData={debitNote as any}
            getPdfBase64={async () => {
              const base64 = generateDebitNotePDF(debitNote, true, false, undefined, false);
              return { base64, filename: `debit-note-${debitNote.debit_note_no}.pdf` };
            }}
          />
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
