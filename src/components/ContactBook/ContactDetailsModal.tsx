"use client";

import React, { useState, useEffect } from 'react';
import { X, Edit2, Trash2, Save, Mail, Phone, MapPin, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { dialogService } from '../../lib/dialogService';
import type { Contact } from '../../types';

interface ContactDetailsModalProps {
  contact: Contact | null;
  isOpen: boolean;
  onClose: () => void;
  onContactUpdated: () => void;
}

const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({
  contact,
  isOpen,
  onClose,
  onContactUpdated,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [editedContact, setEditedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contact) {
      setEditedContact(contact);
      setEditMode(false);
    }
  }, [contact]);

  if (!isOpen || !contact || !editedContact) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_book')
        .update({
          name: editedContact.name,
          address: editedContact.address.filter(a => a.trim()),
          mark: editedContact.mark,
          email: editedContact.email.filter(e => e.trim()),
          contact_no: editedContact.contact_no.filter(p => p.trim()),
        })
        .eq('id', editedContact.id);

      if (error) throw error;

      setEditMode(false);
      onContactUpdated();
      dialogService.success('Contact updated.');
    } catch (error: any) {
      console.error('Error updating contact:', error);
      dialogService.alert({
        title: 'Failed to update contact',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const ok = await dialogService.confirm({
      title: 'Delete contact?',
      message: `Are you sure you want to delete "${contact.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_book')
        .delete()
        .eq('id', contact.id);

      if (error) throw error;

      onClose();
      onContactUpdated();
      dialogService.success('Contact deleted.');
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      dialogService.alert({
        title: 'Failed to delete contact',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleArrayFieldChange = (
    field: 'address' | 'email' | 'contact_no',
    index: number,
    value: string
  ) => {
    const newArray = [...editedContact[field]];
    newArray[index] = value;
    setEditedContact({ ...editedContact, [field]: newArray });
  };

  const addArrayField = (field: 'address' | 'email' | 'contact_no') => {
    setEditedContact({
      ...editedContact,
      [field]: [...editedContact[field], ''],
    });
  };

  const removeArrayField = (field: 'address' | 'email' | 'contact_no', index: number) => {
    const newArray = editedContact[field].filter((_, i) => i !== index);
    setEditedContact({ ...editedContact, [field]: newArray });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {editMode ? 'Edit Contact' : 'Contact Details'}
            </h2>
            {!editMode && contact.mark && (
              <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                {contact.mark}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!editMode && (
              <>
                <button
                  onClick={() => setEditMode(true)}
                  className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-colors"
                  title="Edit"
                >
                  <Edit2 className="h-5 w-5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          {editMode ? (
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                <input
                  type="text"
                  value={editedContact.name}
                  onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Mark</label>
                <input
                  type="text"
                  value={editedContact.mark || ''}
                  onChange={(e) => setEditedContact({ ...editedContact, mark: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="e.g. JI"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Addresses</label>
                  <button type="button" onClick={() => addArrayField('address')} className="text-[10px] font-bold text-blue-600 hover:underline uppercase">+ Add</button>
                </div>
                {editedContact.address.map((addr, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={addr}
                      onChange={(e) => handleArrayFieldChange('address', index, e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button onClick={() => removeArrayField('address', index)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Emails</label>
                  <button type="button" onClick={() => addArrayField('email')} className="text-[10px] font-bold text-blue-600 hover:underline uppercase">+ Add</button>
                </div>
                {editedContact.email.map((email, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => handleArrayFieldChange('email', index, e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button onClick={() => removeArrayField('email', index)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phones</label>
                  <button type="button" onClick={() => addArrayField('contact_no')} className="text-[10px] font-bold text-blue-600 hover:underline uppercase">+ Add</button>
                </div>
                {editedContact.contact_no.map((phone, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => handleArrayFieldChange('contact_no', index, e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                    <button onClick={() => removeArrayField('contact_no', index)} className="text-slate-400 hover:text-red-600 p-2"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Name</p>
                <p className="text-2xl font-bold text-gray-900">{contact.name}</p>
              </div>

              {contact.address.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Addresses</p>
                  <div className="space-y-2">
                    {contact.address.map((addr, index) => (
                      <div key={index} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-900 leading-relaxed">{addr}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contact.email.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Emails</p>
                    <div className="space-y-2">
                      {contact.email.map((email, index) => (
                        <a 
                          key={index} 
                          href={`mailto:${email}`}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-blue-50 hover:border-blue-100 transition-colors group"
                        >
                          <Mail className="h-4 w-4 text-slate-400 group-hover:text-blue-500 flex-shrink-0" />
                          <p className="text-sm text-gray-900 truncate">{email}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {contact.contact_no.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Phones</p>
                    <div className="space-y-2">
                      {contact.contact_no.map((phone, index) => (
                        <a 
                          key={index} 
                          href={`tel:${phone}`}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-green-50 hover:border-green-100 transition-colors group"
                        >
                          <Phone className="h-4 w-4 text-slate-400 group-hover:text-green-500 flex-shrink-0" />
                          <p className="text-sm text-gray-900">{phone}</p>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-50 bg-white flex gap-3">
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="flex-1 px-6 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-[2] px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 disabled:opacity-50 shadow-lg shadow-blue-200 transition-all active:scale-95"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-6 py-3 text-sm font-bold text-slate-500 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactDetailsModal;