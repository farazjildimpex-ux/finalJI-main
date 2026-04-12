import React from 'react';
import { Mail, Phone, Calendar, ExternalLink, MapPin } from 'lucide-react';
import type { Lead } from '../../types';

interface LeadsListProps {
  leads: Lead[];
  loading: boolean;
  onLeadSelect: (lead: Lead) => void;
  onEmailLead: (lead: Lead) => void;
  onCallLead: (lead: Lead) => void;
  getStatusColor: (status: string) => string;
  getSourceColor: (source: string) => string;
}

const LeadsList: React.FC<LeadsListProps> = ({
  leads,
  loading,
  onLeadSelect,
  onEmailLead,
  onCallLead,
  getStatusColor,
  getSourceColor
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg mb-2">No leads found</p>
          <p className="text-sm">Import leads or add them manually to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Desktop View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company & Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onLeadSelect(lead)}
                className="hover:bg-gray-50 cursor-pointer"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{lead.company_name}</div>
                    <div className="text-sm text-gray-500">{lead.contact_person}</div>
                    <div className="text-sm text-gray-500">{lead.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSourceColor(lead.source)}`}>
                    {lead.source.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    {lead.country}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEmailLead(lead);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                      title="Send Email"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCallLead(lead);
                      }}
                      className="text-green-600 hover:text-green-900"
                      title="Log Call"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                    {lead.website && (
                      <a
                        href={lead.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-600 hover:text-gray-900"
                        title="Visit Website"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View */}
      <div className="md:hidden divide-y divide-gray-200">
        {leads.map((lead) => (
          <div
            key={lead.id}
            onClick={() => onLeadSelect(lead)}
            className="p-4 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900 truncate">{lead.company_name}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(lead.status)}`}>
                    {lead.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-1">{lead.contact_person}</p>
                <p className="text-sm text-gray-500 mb-2">{lead.email}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center">
                    <MapPin className="h-3 w-3 mr-1" />
                    {lead.country}
                  </div>
                  <span className={`px-2 py-0.5 rounded ${getSourceColor(lead.source)}`}>
                    {lead.source}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEmailLead(lead);
                  }}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                >
                  <Mail className="h-4 w-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCallLead(lead);
                  }}
                  className="p-2 text-green-600 hover:bg-green-50 rounded"
                >
                  <Phone className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeadsList;