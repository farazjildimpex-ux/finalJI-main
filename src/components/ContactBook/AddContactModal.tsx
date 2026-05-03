import React, { useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { dialogService } from '../../lib/dialogService';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactAdded: () => void;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
      {label}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-slate-400';

const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, onContactAdded }) => {
  const [name, setName] = useState('');
  const [addresses, setAddresses] = useState(['']);
  const [emails, setEmails] = useState(['']);
  const [emailCc, setEmailCc] = useState(['']);
  const [phones, setPhones] = useState(['']);
  const [mark, setMark] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName(''); setAddresses(['']); setEmails(['']); setEmailCc(['']);
    setPhones(['']); setMark(''); setContactPerson('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('contact_book').insert([{
        name:           name.trim(),
        address:        addresses.filter(a => a.trim()),
        email:          emails.filter(e => e.trim()),
        email_cc:       emailCc.filter(e => e.trim()),
        contact_no:     phones.filter(p => p.trim()),
        mark:           mark.trim() || null,
        contact_person: contactPerson.trim() || null,
      }]);
      if (error) throw error;
      onContactAdded();
      onClose();
      resetForm();
    } catch (error: any) {
      console.error('Error adding contact:', error);
      dialogService.alert({ title: 'Failed to add contact', message: error?.message || 'Please try again.', tone: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  /* ── Array field helpers ── */
  const setAt = (setter: React.Dispatch<React.SetStateAction<string[]>>, arr: string[], i: number, val: string) => {
    const next = [...arr]; next[i] = val; setter(next);
  };
  const addRow = (setter: React.Dispatch<React.SetStateAction<string[]>>, arr: string[]) => setter([...arr, '']);
  const removeRow = (setter: React.Dispatch<React.SetStateAction<string[]>>, arr: string[], i: number) => {
    if (arr.length > 1) setter(arr.filter((_, idx) => idx !== i));
  };

  const ArraySection: React.FC<{
    label: string;
    addLabel: string;
    type?: string;
    placeholder?: string;
    arr: string[];
    setter: React.Dispatch<React.SetStateAction<string[]>>;
  }> = ({ label, addLabel, type = 'text', placeholder, arr, setter }) => (
    <Field label={label}>
      <div className="space-y-2">
        {arr.map((val, i) => (
          <div key={i} className="flex gap-2">
            <input
              type={type}
              value={val}
              placeholder={placeholder}
              onChange={(e) => setAt(setter, arr, i, e.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => removeRow(setter, arr, i)}
              disabled={arr.length === 1}
              className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => addRow(setter, arr)}
          className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </button>
      </div>
    </Field>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-50 shrink-0">
          <div>
            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mb-0.5">Contact Book</p>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Add New Contact</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company / Name *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Acme Leather Co."
                className={inputCls}
              />
            </Field>
            <Field label="Contact Person">
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. John Smith"
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Mark / Code">
            <input
              type="text"
              value={mark}
              onChange={(e) => setMark(e.target.value)}
              placeholder="e.g. JI, ACME"
              className={`${inputCls} max-w-xs`}
            />
          </Field>

          <ArraySection
            label="Email Addresses"
            addLabel="Add email"
            type="email"
            placeholder="contact@example.com"
            arr={emails}
            setter={setEmails}
          />

          <ArraySection
            label="CC Emails (auto-added in compose)"
            addLabel="Add CC email"
            type="email"
            placeholder="cc@example.com"
            arr={emailCc}
            setter={setEmailCc}
          />

          <ArraySection
            label="Phone Numbers"
            addLabel="Add phone"
            type="tel"
            placeholder="+91 98765 43210"
            arr={phones}
            setter={setPhones}
          />

          <ArraySection
            label="Addresses"
            addLabel="Add address"
            placeholder="123 Street, City, Country"
            arr={addresses}
            setter={setAddresses}
          />
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            disabled={loading || !name.trim()}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-colors disabled:opacity-50 shadow-sm"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddContactModal;
