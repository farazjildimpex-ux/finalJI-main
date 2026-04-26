import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Mail, Phone, MapPin } from 'lucide-react';
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

  useEffect(() => {
    fetchContacts();
  }, []);

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

  const handleContactClick = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDetailsModalOpen(true);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.some(email => email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    contact.contact_no.some(phone => phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 page-fade-in">
      {/* Header */}
      <div className="bg-slate-50 sticky top-0 z-10 px-4 pt-4">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex items-center justify-center mb-2">
            <Book className="h-8 w-8 text-blue-600 mr-2" />
            <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          </div>
          <p className="text-sm text-gray-600">Manage your business contacts and addresses</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center max-w-5xl mx-auto w-full pb-6">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white text-gray-900 text-sm border border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 outline-none transition-all placeholder-gray-400 shadow-sm"
              placeholder="Search by name, email or phone..."
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 text-sm font-bold rounded-2xl text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add New
          </button>
        </div>
      </div>

      {/* Main Content - Full Width Grid */}
      <div className="flex-1 overflow-y-auto max-w-5xl mx-auto w-full px-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-200 rounded-[32px] bg-white/50">
            <Book className="h-12 w-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">No contacts found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className="p-4 rounded-[24px] border border-gray-100 transition-all bg-white shadow-sm hover:shadow-md hover:border-blue-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-bold text-gray-900 flex-1 truncate group-hover:text-blue-600 transition-colors">{contact.name}</h3>
                  {contact.mark && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                      {contact.mark}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {contact.email[0] && (
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <Mail className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      <span className="truncate">{contact.email[0]}</span>
                    </div>
                  )}
                  {contact.contact_no[0] && (
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <Phone className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      <span className="truncate">{contact.contact_no[0]}</span>
                    </div>
                  )}
                  {contact.address[0] && (
                    <div className="flex items-start gap-3 text-xs text-gray-500">
                      <MapPin className="h-4 w-4 text-gray-300 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{contact.address[0]}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={fetchContacts}
      />

      <ContactDetailsModal
        contact={selectedContact}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedContact(null);
        }}
        onContactUpdated={fetchContacts}
      />
    </div>
  );
};

export default ContactBookPage;