import React, { useState } from 'react';
import { X, Upload, Download, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import type { Lead } from '../../types';
import { dialogService } from '../../lib/dialogService';

interface LeadImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsImported: () => void;
}

const LeadImportModal: React.FC<LeadImportModalProps> = ({
  isOpen,
  onClose,
  onLeadsImported
}) => {
  const [loading, setLoading] = useState(false);
  const [importResults, setImportResults] = useState<{
    success: number;
    errors: string[];
    total: number;
  } | null>(null);
  const [selectedSource, setSelectedSource] = useState<'leatherworkinggroup' | 'lineapelle' | 'aplf' | 'csv'>('csv');

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      dialogService.alert({
        title: 'Invalid file type',
        message: 'Please select a CSV file.',
        tone: 'warning',
      });
      return;
    }

    try {
      setLoading(true);
      setImportResults(null);

      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        dialogService.alert({
          title: 'Invalid CSV',
          message: 'CSV file must have at least a header row and one data row.',
          tone: 'warning',
        });
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const dataLines = lines.slice(1);

      // Validate required headers
      const requiredHeaders = ['company_name', 'contact_person', 'email'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        dialogService.alert({
          title: 'Missing required columns',
          message: `Missing required columns: ${missingHeaders.join(', ')}`,
          tone: 'warning',
        });
        return;
      }

      const leads: Partial<Lead>[] = [];
      const errors: string[] = [];

      dataLines.forEach((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        
        if (values.length !== headers.length) {
          errors.push(`Row ${index + 2}: Column count mismatch`);
          return;
        }

        const lead: Partial<Lead> = {
          source: selectedSource === 'csv' ? 'manual' : selectedSource,
          status: 'new',
          address: [],
          tags: []
        };

        headers.forEach((header, i) => {
          const value = values[i];
          
          switch (header) {
            case 'company_name':
              lead.company_name = value;
              break;
            case 'contact_person':
              lead.contact_person = value;
              break;
            case 'email':
              lead.email = value;
              break;
            case 'phone':
              lead.phone = value;
              break;
            case 'website':
              lead.website = value;
              break;
            case 'country':
              lead.country = value;
              break;
            case 'industry_focus':
              lead.industry_focus = value;
              break;
            case 'company_size':
              lead.company_size = value;
              break;
            case 'notes':
              lead.notes = value;
              break;
            case 'address':
              lead.address = value ? [value] : [];
              break;
          }
        });

        // Validate required fields
        if (!lead.company_name || !lead.contact_person || !lead.email) {
          errors.push(`Row ${index + 2}: Missing required fields (company_name, contact_person, email)`);
          return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(lead.email!)) {
          errors.push(`Row ${index + 2}: Invalid email format`);
          return;
        }

        leads.push(lead);
      });

      // Import valid leads
      let successCount = 0;
      for (const lead of leads) {
        try {
          const { error } = await supabase
            .from('leads')
            .insert([lead]);

          if (error) {
            if (error.code === '23505') { // Unique constraint violation
              errors.push(`Duplicate email: ${lead.email}`);
            } else {
              errors.push(`Error importing ${lead.company_name}: ${error.message}`);
            }
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`Error importing ${lead.company_name}: ${err}`);
        }
      }

      setImportResults({
        success: successCount,
        errors,
        total: leads.length
      });

      if (successCount > 0) {
        onLeadsImported();
      }

    } catch (error: any) {
      console.error('Error importing CSV:', error);
      dialogService.alert({
        title: 'Failed to import CSV',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleWebsiteImport = async (source: 'leatherworkinggroup' | 'lineapelle' | 'aplf') => {
    setLoading(true);
    setImportResults(null);

    try {
      // In a real application, you would implement web scraping or API integration
      // For now, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate some sample data based on the source
      const sampleLeads = getSampleLeadsForSource(source);
      
      let successCount = 0;
      const errors: string[] = [];

      for (const lead of sampleLeads) {
        try {
          const { error } = await supabase
            .from('leads')
            .insert([lead]);

          if (error) {
            if (error.code === '23505') {
              errors.push(`Duplicate email: ${lead.email}`);
            } else {
              errors.push(`Error importing ${lead.company_name}: ${error.message}`);
            }
          } else {
            successCount++;
          }
        } catch (err) {
          errors.push(`Error importing ${lead.company_name}: ${err}`);
        }
      }

      setImportResults({
        success: successCount,
        errors,
        total: sampleLeads.length
      });

      if (successCount > 0) {
        onLeadsImported();
      }

    } catch (error: any) {
      console.error('Error importing from website:', error);
      dialogService.alert({
        title: 'Failed to import from website',
        message: error?.message || 'Please try again.',
        tone: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const getSampleLeadsForSource = (source: string): Partial<Lead>[] => {
    // This would be replaced with actual web scraping or API calls
    const samples = {
      leatherworkinggroup: [
        {
          company_name: 'Premium Leather Co.',
          contact_person: 'John Smith',
          email: 'john@premiumleather.com',
          country: 'Italy',
          source: 'leatherworkinggroup' as const,
          status: 'new' as const,
          industry_focus: 'Luxury Goods',
          address: [],
          tags: []
        },
        {
          company_name: 'European Tannery Ltd',
          contact_person: 'Maria Garcia',
          email: 'maria@eutannery.com',
          country: 'Spain',
          source: 'leatherworkinggroup' as const,
          status: 'new' as const,
          industry_focus: 'Automotive',
          address: [],
          tags: []
        }
      ],
      lineapelle: [
        {
          company_name: 'Milano Leather House',
          contact_person: 'Giuseppe Rossi',
          email: 'giuseppe@milanoleather.it',
          country: 'Italy',
          source: 'lineapelle' as const,
          status: 'new' as const,
          industry_focus: 'Fashion',
          address: [],
          tags: []
        }
      ],
      aplf: [
        {
          company_name: 'Asia Pacific Leather',
          contact_person: 'Li Wei',
          email: 'li.wei@apleather.com',
          country: 'China',
          source: 'aplf' as const,
          status: 'new' as const,
          industry_focus: 'Footwear',
          address: [],
          tags: []
        }
      ]
    };

    return samples[source] || [];
  };

  const downloadSampleCSV = () => {
    const csvContent = `company_name,contact_person,email,phone,website,country,industry_focus,company_size,notes,address
"Premium Leather Co.","John Smith","john@example.com","+1234567890","https://example.com","USA","Footwear","51-200","Interested in high-quality leather","123 Main St, New York"
"European Tannery","Maria Garcia","maria@example.com","+34123456789","https://example.eu","Spain","Automotive","201-1000","Automotive leather specialist","Calle Mayor 1, Madrid"`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_leads.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Import Leads</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Import Source Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Import Source
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => setSelectedSource('csv')}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedSource === 'csv' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <Upload className="h-6 w-6 text-gray-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">CSV Upload</h4>
                      <p className="text-sm text-gray-500">Upload a CSV file with lead data</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedSource('leatherworkinggroup')}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedSource === 'leatherworkinggroup' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <RefreshCw className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Leather Working Group</h4>
                      <p className="text-sm text-gray-500">Import from member directory</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedSource('lineapelle')}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedSource === 'lineapelle' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <RefreshCw className="h-6 w-6 text-purple-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">Lineapelle</h4>
                      <p className="text-sm text-gray-500">Import from exhibitor list</p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedSource('aplf')}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    selectedSource === 'aplf' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center">
                    <RefreshCw className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <h4 className="font-medium text-gray-900">APLF</h4>
                      <p className="text-sm text-gray-500">Import from member database</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Import Actions */}
            <div className="border-t border-gray-200 pt-6">
              {selectedSource === 'csv' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-gray-900">CSV Import</h4>
                    <button
                      onClick={downloadSampleCSV}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download Sample CSV
                    </button>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-blue-800 mb-2">CSV Format Requirements:</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Required columns: company_name, contact_person, email</li>
                      <li>• Optional columns: phone, website, country, industry_focus, company_size, notes, address</li>
                      <li>• First row should contain column headers</li>
                      <li>• Use commas to separate values</li>
                      <li>• Enclose values with commas in quotes</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select CSV File
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleCSVImport}
                      disabled={loading}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="text-lg font-medium text-gray-900">
                    Import from {selectedSource.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </h4>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-sm font-medium text-yellow-800">Demo Mode</h5>
                        <p className="text-sm text-yellow-700 mt-1">
                          This is a demonstration. In production, this would connect to the actual {selectedSource} API or scrape their member directory.
                          For now, it will import sample data to show how the feature works.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleWebsiteImport(selectedSource as 'leatherworkinggroup' | 'lineapelle' | 'aplf')}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Import from {selectedSource}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Import Results */}
            {importResults && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Import Results</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <CheckCircle className="h-6 w-6 text-green-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-green-800">Successful</p>
                        <p className="text-2xl font-bold text-green-900">{importResults.success}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertCircle className="h-6 w-6 text-red-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Errors</p>
                        <p className="text-2xl font-bold text-red-900">{importResults.errors.length}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <Upload className="h-6 w-6 text-blue-600 mr-2" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Total Processed</p>
                        <p className="text-2xl font-bold text-blue-900">{importResults.total}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {importResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-red-800 mb-2">Errors:</h5>
                    <div className="max-h-32 overflow-y-auto">
                      <ul className="text-sm text-red-700 space-y-1">
                        {importResults.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeadImportModal;