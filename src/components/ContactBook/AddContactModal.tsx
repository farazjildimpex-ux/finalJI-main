import React, { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContactAdded: () => void;
}

const AddContactModal: React.FC<AddContactModalProps> = ({ isOpen, onClose, onContactAdded }) => {
  const [name, setName] = useState('');
  const [addresses, setAddresses] = useState(['']);
  const [emails, setEmails] = useState(['']);
  const [phones, setPhones] = useState(['']);
  const [mark, setMark] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('contact_book')
        .insert([
          {
            name,
            address: addresses.filter(addr => addr.trim() !== ''),
            email: emails.filter(email => email.trim() !== ''),
            contact_no: phones.filter(phone => phone.trim() !== ''),
            mark: mark.trim() !== '' ? mark : null,
          },
        ]);

      if (error) throw error;

      onContactAdded();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error adding contact:', error);
      alert('Failed to add contact. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setAddresses(['']);
    setEmails(['']);
    setPhones(['']);
    setMark('');
  };

  const handleArrayFieldChange = (
    index: number,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    array: string[]
  ) => {
    const newArray = [...array];
    newArray[index] = value;
    setter(newArray);
  };

  const addField = (setter: React.Dispatch<React.SetStateAction<string[]>>, array: string[]) => {
    setter([...array, '']);
  };

  const removeField = (
    index: number,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    array: string[]
  ) => {
    if (array.length > 1) {
      const newArray = array.filter((_, i) => i !== index);
      setter(newArray);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Add New Contact</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Name */}
            <div className="mb-6">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Addresses */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Addresses</label>
              {addresses.map((address, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => handleArrayFieldChange(index, e.target.value, setAddresses, addresses)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeField(index, setAddresses, addresses)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addField(setAddresses, addresses)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Address
              </button>
            </div>

            {/* Emails */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Addresses</label>
              {emails.map((email, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => handleArrayFieldChange(index, e.target.value, setEmails, emails)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeField(index, setEmails, emails)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addField(setEmails, emails)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Email
              </button>
            </div>

            {/* Phone Numbers */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Numbers</label>
              {phones.map((phone, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => handleArrayFieldChange(index, e.target.value, setPhones, phones)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeField(index, setPhones, phones)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addField(setPhones, phones)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Phone
              </button>
            </div>

            {/* Mark */}
            <div className="mb-6">
              <label htmlFor="mark" className="block text-sm font-medium text-gray-700 mb-1">
                Mark
              </label>
              <input
                type="text"
                id="mark"
                value={mark}
                onChange={(e) => setMark(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddContactModal;