import React, { useState, useEffect } from 'react';
import { Plus, Search, Mail, Phone, MapPin, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AddContactModal from './AddContactModal';
import ContactDetailsModal from './ContactDetailsModal';
import type { Contact } from '../../types';

const ContactBookPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_book')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.some(email => email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    contact.contact_no.some(phone => phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 page-fade-in">
      {/* Header */}
      <div className="bg-slate-50 sticky top-0 z-10 px-4 pt-5 pb-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Contacts</h1>
              <p className="text-xs text-slate-500 mt-1">Manage your business contacts and addresses</p>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm active:scale-95"
            >
              <Plus className="h-4 w-4" /> Add New
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 text-sm border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder-slate-400 shadow-sm"
              placeholder="Search by name, email or phone…"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full px-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
            <Users className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm font-semibold">No contacts found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => { setSelectedContact(contact); setIsDetailsModalOpen(true); }}
                className="p-4 rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer group transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex-1 truncate group-hover:text-blue-600 transition-colors">
                    {contact.name}
                  </h3>
                  {contact.mark && (
                    <span className="ml-2 shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700">
                      {contact.mark}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {contact.email[0] && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Mail className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      <span className="truncate">{contact.email[0]}</span>
                    </div>
                  )}
                  {contact.contact_no[0] && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                      <span className="truncate">{contact.contact_no[0]}</span>
                    </div>
                  )}
                  {contact.address[0] && (
                    <div className="flex items-start gap-2 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{contact.address[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={fetchContacts}
      />
      <ContactDetailsModal
        contact={selectedContact}
        isOpen={isDetailsModalOpen}
        onClose={() => { setIsDetailsModalOpen(false); setSelectedContact(null); }}
        onContactUpdated={fetchContacts}
      />
    </div>
  );
};

export default ContactBookPage;
