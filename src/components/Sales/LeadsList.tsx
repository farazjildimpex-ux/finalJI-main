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
      <div className="bg-white rounded-2xl shadow p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" aria-hidden />
        <span className="sr-only">Loading leads</span>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-500">
        <div className="text-center py-12">
          <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg mb-2">No leads found</p>
          <p className="text-sm">Import leads or add them manually to get started</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 rounded-2xl overflow-hidden">
      {/* Desktop Table (polished) */}
      <div className="hidden md:block">
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Company & Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Contact</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id} onClick={() => onLeadSelect(lead)} className="hover:bg-slate-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{lead.company_name}</div>
                      <div className="text-sm text-slate-500">{lead.contact_person}</div>
                      <div className="text-sm text-slate-400">{lead.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                      {lead.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getSourceColor(lead.source)}`}>
                      {lead.source.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1 text-slate-400" />
                      {lead.country || '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEmailLead(lead); }}
                        className="p-2 rounded-md text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
                        aria-label={`Email ${lead.company_name}`}
                      >
                        <Mail className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onCallLead(lead); }}
                        className="p-2 rounded-md text-green-600 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-200"
                        aria-label={`Log call for ${lead.company_name}`}
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      {lead.website && (
                        <a
                          href={lead.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-md text-slate-500 hover:bg-slate-50"
                          aria-label={`Visit website for ${lead.company_name}`}
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
      </div>

      {/* Mobile: card-first list that matches app language */}
      <div className="md:hidden space-y-3 p-3">
        {leads.map((lead) => (
          <article
            key={lead.id}
            onClick={() => onLeadSelect(lead)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onLeadSelect(lead); }}
            className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3"
            aria-label={`Open lead ${lead.company_name}`}
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 font-bold">
              {lead.company_name ? lead.company_name.charAt(0).toUpperCase() : 'L'}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{lead.company_name}</p>
                  <p className="text-xs text-slate-500 truncate">{lead.contact_person} · <span className="text-slate-400">{lead.email}</span></p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusColor(lead.status)}`}>
                    {lead.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <span>{lead.country || '—'}</span>
                  </div>

                  <div className={`px-2 py-0.5 rounded text-[11px] font-medium ${getSourceColor(lead.source)}`}>
                    {lead.source}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEmailLead(lead); }}
                    className="p-2 bg-white border border-slate-100 rounded-lg text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    aria-label={`Email ${lead.company_name}`}
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onCallLead(lead); }}
                    className="p-2 bg-white border border-slate-100 rounded-lg text-green-600 hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-100"
                    aria-label={`Log call for ${lead.company_name}`}
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default LeadsList;
