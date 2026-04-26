import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Edit2, Trash2, Save, Mail, Phone, MapPin, ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import AddContactModal from './AddContactModal';
import { dialogService } from '../../lib/dialogService';

interface Contact {
  id: string;
  name: string;
  address: string[];
  mark: string | null;
  email: string[];
  contact_no: string[];
  created_at: string;
  updated_at: string;
}

const ContactBookPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedContact, setEditedContact] = useState<Contact | null>(null);

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

  const handleEdit = () => {
    setEditedContact(selectedContact);
    setEditMode(true);
  };

  const handleSave = async () => {
    if (!editedContact) return;

    try {
      const { error } = await supabase
        .from('contact_book')
        .update({
          name: editedContact.name,
          address: editedContact.address,
          mark: editedContact.mark,
          email: editedContact.email,
          contact_no: editedContact.contact_no,
        })
        .eq('id', editedContact.id);

      if (error) throw error;

      setEditMode(false);
      setSelectedContact(editedContact);
      await fetchContacts();
      dialogService.success('Contact updated.');
    } catch (error: any) {
      console.error('Error updating contact:', error);
      dialogService.alert({
        title: 'Failed to update contact',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    }
  };

  const handleDelete = async (contactId: string) => {
    const ok = await dialogService.confirm({
      title: 'Delete contact?',
      message: 'Are you sure you want to delete this contact? This action cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('contact_book')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      await fetchContacts();
      if (selectedContact?.id === contactId) {
        setSelectedContact(null);
        setEditedContact(null);
        setEditMode(false);
      }
      dialogService.success('Contact deleted.');
    } catch (error: any) {
      console.error('Error deleting contact:', error);
      dialogService.alert({
        title: 'Failed to delete contact',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    }
  };

  const handleArrayFieldChange = (
    field: 'address' | 'email' | 'contact_no',
    index: number,
    value: string
  ) => {
    if (!editedContact) return;

    const newArray = [...editedContact[field]];
    newArray[index] = value;
    setEditedContact({ ...editedContact, [field]: newArray });
  };

  const addArrayField = (field: 'address' | 'email' | 'contact_no') => {
    if (!editedContact) return;
    setEditedContact({
      ...editedContact,
      [field]: [...editedContact[field], ''],
    });
  };

  const removeArrayField = (field: 'address' | 'email' | 'contact_no', index: number) => {
    if (!editedContact) return;
    const newArray = editedContact[field].filter((_, i) => i !== index);
    setEditedContact({ ...editedContact, [field]: newArray });
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email.some(email => email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    contact.contact_no.some(phone => phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 page-fade-in">
      {/* Header */}
      <div className="bg-slate-50 sticky top-0 z-10 px-2 md:px-3 pt-4">
        <div className="mb-4 md:mb-6 flex flex-col items-center text-center">
          <div className="flex items-center justify-center mb-2">
            <Book className="h-6 w-6 md:h-8 md:w-8 text-blue-600 mr-2" />
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Contacts</h1>
          </div>
          <p className="text-xs md:text-sm text-gray-600">Manage your business contacts and addresses</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center max-w-5xl mx-auto w-full pb-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white text-gray-900 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-400 shadow-sm"
              placeholder="Search by name, email or phone..."
            />
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 text-xs font-bold uppercase rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden max-w-5xl mx-auto w-full px-2 md:px-3">
        {/* Contacts List */}
        <div className={`flex-1 overflow-y-auto py-2 md:py-4 ${selectedContact ? 'hidden md:block' : 'block'}`}>
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl">
              <Book className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No contacts found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  onClick={() => {
                    setSelectedContact(contact);
                    setEditMode(false);
                    setEditedContact(null);
                  }}
                  className={`p-4 rounded-2xl border transition-all bg-white shadow-sm cursor-pointer ${
                    selectedContact?.id === contact.id
                      ? 'border-blue-500 ring-2 ring-blue-500/10'
                      : 'border-gray-200 hover:border-blue-200'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-bold text-gray-900 flex-1 truncate">{contact.name}</h3>
                    {contact.mark && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        {contact.mark}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {contact.email[0] && (
                      <div className="flex items-center gap-2.5 text-xs text-gray-600">
                        <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{contact.email[0]}</span>
                      </div>
                    )}
                    {contact.contact_no[0] && (
                      <div className="flex items-center gap-2.5 text-xs text-gray-600">
                        <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{contact.contact_no[0]}</span>
                      </div>
                    )}
                    {contact.address[0] && (
                      <div className="flex items-start gap-2.5 text-xs text-gray-600">
                        <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{contact.address[0]}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details Panel */}
        {selectedContact && (
          <div className={`w-full md:w-[400px] bg-white border-l border-gray-200 flex flex-col overflow-hidden ${selectedContact ? 'fixed inset-0 z-[60] md:relative md:inset-auto md:z-auto' : 'hidden'}`}>
            {/* Details Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedContact(null)}
                  className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Contact Details</h2>
              </div>
              {!editMode && (
                <div className="flex gap-1">
                  <button
                    onClick={handleEdit}
                    className="p-2 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(selectedContact.id)}
                    className="p-2 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Details Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {editMode && editedContact ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Name</label>
                    <input
                      type="text"
                      value={editedContact.name}
                      onChange={(e) => setEditedContact({ ...editedContact, name: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Mark</label>
                    <input
                      type="text"
                      value={editedContact.mark || ''}
                      onChange={(e) => setEditedContact({ ...editedContact, mark: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 ml-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Addresses</label>
                      <button
                        type="button"
                        onClick={() => addArrayField('address')}
                        className="text-[10px] font-bold text-blue-600 hover:underline uppercase"
                      >
                        + Add
                      </button>
                    </div>
                    {editedContact.address.map((addr, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={addr}
                          onChange={(e) => handleArrayFieldChange('address', index, e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={() => removeArrayField('address', index)}
                          className="text-gray-400 hover:text-red-600 p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 ml-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Emails</label>
                      <button
                        type="button"
                        onClick={() => addArrayField('email')}
                        className="text-[10px] font-bold text-blue-600 hover:underline uppercase"
                      >
                        + Add
                      </button>
                    </div>
                    {editedContact.email.map((email, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleArrayFieldChange('email', index, e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={() => removeArrayField('email', index)}
                          className="text-gray-400 hover:text-red-600 p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 ml-1">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest">Phones</label>
                      <button
                        type="button"
                        onClick={() => addArrayField('contact_no')}
                        className="text-[10px] font-bold text-blue-600 hover:underline uppercase"
                      >
                        + Add
                      </button>
                    </div>
                    {editedContact.contact_no.map((phone, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => handleArrayFieldChange('contact_no', index, e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={() => removeArrayField('contact_no', index)}
                          className="text-gray-400 hover:text-red-600 p-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Name</p>
                    <p className="text-lg font-bold text-gray-900">{selectedContact.name}</p>
                  </div>

                  {selectedContact.mark && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Mark</p>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                        {selectedContact.mark}
                      </span>
                    </div>
                  )}

                  {selectedContact.address.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Addresses</p>
                      <div className="space-y-2">
                        {selectedContact.address.map((addr, index) => (
                          <div key={index} className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-gray-100">
                            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-gray-900 leading-relaxed">{addr}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContact.email.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Emails</p>
                      <div className="space-y-2">
                        {selectedContact.email.map((email, index) => (
                          <a 
                            key={index} 
                            href={`mailto:${email}`}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-gray-100 hover:bg-blue-50 hover:border-blue-100 transition-colors group"
                          >
                            <Mail className="h-4 w-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
                            <p className="text-xs text-gray-900 truncate">{email}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContact.contact_no.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Phones</p>
                      <div className="space-y-2">
                        {selectedContact.contact_no.map((phone, index) => (
                          <a 
                            key={index} 
                            href={`tel:${phone}`}
                            className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-gray-100 hover:bg-green-50 hover:border-green-100 transition-colors group"
                          >
                            <Phone className="h-4 w-4 text-gray-400 group-hover:text-green-500 flex-shrink-0" />
                            <p className="text-xs text-gray-900">{phone}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {editMode && (
              <div className="p-4 border-t border-gray-200 flex gap-2 bg-white">
                <button
                  onClick={() => setEditMode(false)}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold uppercase rounded-xl text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-xs font-bold uppercase rounded-xl text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <AddContactModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onContactAdded={fetchContacts}
      />
    </div>
  );
};

export default ContactBookPage;