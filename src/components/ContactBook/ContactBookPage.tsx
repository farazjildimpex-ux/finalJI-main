import React, { useState, useEffect } from 'react';
import { Plus, Search, Mail, Phone, MapPin, Users } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AddContactModal from './AddContactModal';
import ContactDetailsModal from './ContactDetailsModal';
import type { Contact } from '../../types';

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
];

function avatarColor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

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
    contact.email.some(e => e.toLowerCase().includes(searchTerm.toLowerCase())) ||
    contact.contact_no.some(p => p.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-full bg-gray-50/60">
      <div className="px-4 py-6 max-w-5xl mx-auto space-y-4 page-fade-in">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-500 mb-1">Directory</p>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Contacts</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Loading…' : `${contacts.length} business contact${contacts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" /> Add Contact
          </button>
        </div>

        {/* ── Search ── */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 text-sm border border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all placeholder-slate-400 shadow-sm"
            placeholder="Search by name, email or phone…"
          />
        </div>

        {/* ── Contact list ── */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 bg-white rounded-3xl border border-dashed border-gray-200">
            <Users className="h-10 w-10 mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">
              {searchTerm ? 'No contacts match your search' : 'No contacts yet'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-3 text-xs font-bold text-blue-600 hover:underline"
              >
                Add your first contact
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredContacts.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => { setSelectedContact(contact); setIsDetailsModalOpen(true); }}
                className="text-left p-4 bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer group transition-all active:scale-[0.98]"
              >
                {/* Avatar + name row */}
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 ${avatarColor(contact.name)}`}>
                    {getInitials(contact.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {contact.name}
                    </p>
                    {contact.contact_person && (
                      <p className="text-[11px] text-slate-400 truncate">{contact.contact_person}</p>
                    )}
                  </div>
                  {contact.mark && (
                    <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700">
                      {contact.mark}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 pl-1">
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
              </button>
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
