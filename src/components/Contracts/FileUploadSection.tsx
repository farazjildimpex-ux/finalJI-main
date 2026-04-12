import React, { useState, useEffect, useRef } from 'react';
import { Upload, File, Image, Trash2, Download, CheckCircle, AlertCircle, X, Link, Search, ExternalLink, Wifi, WifiOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface ContractFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  contract_id: string;
  linked_contracts?: string[];
}

interface FileUploadSectionProps {
  contractId: string;
  contractNumber?: string;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

interface PreviewModalProps {
  file: ContractFile | null;
  isOpen: boolean;
  onClose: () => void;
  onFileNotFound: (fileId: string) => void;
}

interface LinkDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLinkDocument: (fileId: string) => void;
  currentContractId: string;
}

const LinkDocumentModal: React.FC<LinkDocumentModalProps> = ({ 
  isOpen, 
  onClose, 
  onLinkDocument, 
  currentContractId 
}) => {
  const [availableFiles, setAvailableFiles] = useState<ContractFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableFiles();
    }
  }, [isOpen, currentContractId]);

  const isConnectionError = (error: any) => {
    return error?.message?.includes('refused to connect') ||
           error?.message?.includes('Failed to fetch') ||
           error?.message?.includes('Network request failed') ||
           error?.code === 'NETWORK_ERROR' ||
           error?.name === 'NetworkError';
  };

  const fetchAvailableFiles = async () => {
    try {
      setLoading(true);
      setConnectionError(false);
      
      // Get all files that are not already linked to current contract
      const { data, error } = await supabase
        .from('contract_files')
        .select(`
          *,
          contracts!inner(contract_no)
        `)
        .not('linked_contracts', 'cs', `{${currentContractId}}`)
        .neq('contract_id', currentContractId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isConnectionError(error)) {
          setConnectionError(true);
          return;
        }
        throw error;
      }
      setAvailableFiles(data || []);
    } catch (error) {
      console.error('Error fetching available files:', error);
      if (isConnectionError(error)) {
        setConnectionError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = availableFiles.filter(file =>
    file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file as any).contracts?.contract_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Link Existing Document</h3>
            <p className="text-sm text-gray-500 mt-1">
              Select a document from another contract to link to this contract
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Connection Error */}
        {connectionError && (
          <div className="p-6 border-b border-gray-200">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <WifiOff className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Unable to connect to the server. Please check your internet connection and try again.
                  </p>
                  <button
                    onClick={fetchAvailableFiles}
                    className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        {!connectionError && (
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by file name or contract number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Files List */}
        <div className="flex-1 overflow-y-auto max-h-96">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : connectionError ? (
            <div className="text-center py-12">
              <WifiOff className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Unable to load documents due to connection issues</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No files found matching your search' : 'No documents available to link'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => onLinkDocument(file.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {getFileIcon(file.mime_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.file_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          From: {(file as any).contracts?.contract_no || 'Unknown Contract'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                        </p>
                        {file.linked_contracts && file.linked_contracts.length > 0 && (
                          <p className="text-xs text-blue-600">
                            Linked to {file.linked_contracts.length} other contract(s)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        Link Document
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PreviewModal: React.FC<PreviewModalProps> = ({ file, isOpen, onClose, onFileNotFound }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    if (isOpen && file) {
      loadFileForPreview();
    } else {
      // Clean up the URL when modal closes
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
        setFileUrl(null);
      }
      setError(null);
      setConnectionError(false);
    }

    // Cleanup function
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [isOpen, file]);

  const isFileNotFoundError = (error: any) => {
    return error?.message?.includes('Object not found') || 
           error?.statusCode === '404' || 
           error?.status === 404;
  };

  const isConnectionError = (error: any) => {
    return error?.message?.includes('refused to connect') ||
           error?.message?.includes('Failed to fetch') ||
           error?.message?.includes('Network request failed') ||
           error?.code === 'NETWORK_ERROR' ||
           error?.name === 'NetworkError';
  };

  const loadFileForPreview = async () => {
    if (!file) return;
    
    try {
      setLoading(true);
      setError(null);
      setConnectionError(false);

      // Get the public URL for the file
      const { data: urlData } = supabase.storage
        .from('contract-files')
        .getPublicUrl(file.file_path);

      if (urlData?.publicUrl) {
        // For images and PDFs, we can use the public URL directly
        if (file.mime_type.startsWith('image/') || file.mime_type === 'application/pdf') {
          setFileUrl(urlData.publicUrl);
        } else {
          // For other file types, try to download and create blob URL
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('contract-files')
              .download(file.file_path);

            if (downloadError) {
              if (isConnectionError(downloadError)) {
                setConnectionError(true);
                return;
              }
              if (isFileNotFoundError(downloadError)) {
                // File not found in storage, clean up database entry
                onFileNotFound(file.id);
                setError('This file is no longer available and has been removed from the list.');
                return;
              }
              // If download fails for other reasons, still try to use public URL
              // Only log non-file-not-found errors to console
              if (!isFileNotFoundError(downloadError)) {
                console.warn('Download failed, using public URL:', downloadError);
              }
              setFileUrl(urlData.publicUrl);
            } else {
              const url = URL.createObjectURL(fileData);
              setFileUrl(url);
            }
          } catch (downloadError) {
            if (isConnectionError(downloadError)) {
              setConnectionError(true);
              return;
            }
            if (isFileNotFoundError(downloadError)) {
              onFileNotFound(file.id);
              setError('This file is no longer available and has been removed from the list.');
              return;
            }
            // Only log non-file-not-found errors to console
            if (!isFileNotFoundError(downloadError)) {
              console.warn('Download failed, using public URL:', downloadError);
            }
            setFileUrl(urlData.publicUrl);
          }
        }
      } else {
        throw new Error('Could not generate file URL');
      }
    } catch (error) {
      if (isConnectionError(error)) {
        setConnectionError(true);
      } else if (isFileNotFoundError(error)) {
        onFileNotFound(file.id);
        setError('This file is no longer available and has been removed from the list.');
      } else {
        // Only log non-file-not-found errors to console
        console.error('Error loading file for preview:', error);
        setError('Failed to load file for preview. The file may not be accessible.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    
    try {
      setConnectionError(false);
      
      // Try to download the file
      const { data, error } = await supabase.storage
        .from('contract-files')
        .download(file.file_path);

      if (error) {
        if (isConnectionError(error)) {
          setConnectionError(true);
          return;
        }
        if (isFileNotFoundError(error)) {
          // File not found in storage, clean up database entry
          onFileNotFound(file.id);
          alert('This file is no longer available and has been removed from the list.');
          return;
        }
        
        // If download fails for other reasons, try to open the public URL in a new tab
        const { data: urlData } = supabase.storage
          .from('contract-files')
          .getPublicUrl(file.file_path);
        
        if (urlData?.publicUrl) {
          window.open(urlData.publicUrl, '_blank');
          return;
        }
        throw error;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      if (isConnectionError(error)) {
        setConnectionError(true);
      } else if (isFileNotFoundError(error)) {
        onFileNotFound(file.id);
        alert('This file is no longer available and has been removed from the list.');
      } else {
        // Only log non-file-not-found errors to console
        console.error('Error downloading file:', error);
        alert('Failed to download file. Please try again.');
      }
    }
  };

  const openInNewTab = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  const retryLoad = () => {
    setConnectionError(false);
    setError(null);
    loadFileForPreview();
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {file.mime_type.startsWith('image/') ? (
              <Image className="h-6 w-6 text-blue-500" />
            ) : (
              <File className="h-6 w-6 text-gray-500" />
            )}
            <div>
              <h3 className="text-lg font-medium text-gray-900 truncate">{file.file_name}</h3>
              <p className="text-sm text-gray-500">
                {file.mime_type} • {formatFileSize(file.file_size)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {fileUrl && !connectionError && (
              <button
                onClick={openInNewTab}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={connectionError}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(95vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading preview...</p>
              </div>
            </div>
          ) : connectionError ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <WifiOff className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Connection Error</h3>
                <p className="text-gray-600 mb-4">
                  Unable to connect to the server. Please check your internet connection.
                </p>
                <div className="space-x-2">
                  <button
                    onClick={retryLoad}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Wifi className="h-4 w-4 mr-2" />
                    Retry Connection
                  </button>
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Try Download
                  </button>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">{error}</p>
                {!error.includes('no longer available') && (
                  <button
                    onClick={handleDownload}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download File
                  </button>
                )}
              </div>
            </div>
          ) : fileUrl ? (
            <div className="p-4">
              {file.mime_type.startsWith('image/') ? (
                <div className="flex justify-center">
                  <img
                    src={fileUrl}
                    alt={file.file_name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                    onError={() => setError('Failed to load image')}
                  />
                </div>
              ) : file.mime_type === 'application/pdf' ? (
                <div className="w-full h-[70vh]">
                  <iframe
                    src={fileUrl}
                    className="w-full h-full border rounded-lg"
                    title={file.file_name}
                    onError={() => setError('Failed to load PDF')}
                  />
                </div>
              ) : (
                <div className="text-center py-12">
                  <File className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                  <div className="space-x-2">
                    <button
                      onClick={handleDownload}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download to View
                    </button>
                    {fileUrl && (
                      <button
                        onClick={openInNewTab}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Failed to load file preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const FileUploadSection: React.FC<FileUploadSectionProps> = ({ contractId, contractNumber }) => {
  const [files, setFiles] = useState<ContractFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [previewFile, setPreviewFile] = useState<ContractFile | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (contractId) {
      fetchFiles();
    }
  }, [contractId]);

  const addNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const notification = { id, type, message };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const isFileNotFoundError = (error: any) => {
    return error?.message?.includes('Object not found') || 
           error?.statusCode === '404' || 
           error?.status === 404;
  };

  const isConnectionError = (error: any) => {
    return error?.message?.includes('refused to connect') ||
           error?.message?.includes('Failed to fetch') ||
           error?.message?.includes('Network request failed') ||
           error?.code === 'NETWORK_ERROR' ||
           error?.name === 'NetworkError';
  };

  const handleFileNotFound = async (fileId: string) => {
    try {
      // Remove the file entry from the database since it doesn't exist in storage
      const { error } = await supabase
        .from('contract_files')
        .delete()
        .eq('id', fileId);

      if (error) {
        console.error('Error cleaning up missing file:', error);
      } else {
        // Refresh the file list to remove the missing file from UI
        await fetchFiles();
        addNotification('error', 'File was missing from storage and has been removed from the list.');
      }
    } catch (error) {
      console.error('Error handling missing file:', error);
    }
    
    // Close the preview modal if it's open
    if (isPreviewOpen) {
      setIsPreviewOpen(false);
      setPreviewFile(null);
    }
  };

  const fetchFiles = async () => {
    try {
      setConnectionError(false);
      // Get files that belong to this contract OR are linked to this contract
      const { data, error } = await supabase
        .from('contract_files')
        .select('*')
        .or(`contract_id.eq.${contractId},linked_contracts.cs.{${contractId}}`)
        .order('created_at', { ascending: false });

      if (error) {
        if (isConnectionError(error)) {
          setConnectionError(true);
          addNotification('error', 'Unable to connect to server. Please check your internet connection.');
          return;
        }
        throw error;
      }
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      if (isConnectionError(error)) {
        setConnectionError(true);
        addNotification('error', 'Connection failed. Please check your internet connection and try again.');
      } else {
        addNotification('error', 'Failed to fetch files');
      }
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File) => {
    try {
      setUploading(true);
      setConnectionError(false);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        if (isConnectionError(userError)) {
          setConnectionError(true);
          addNotification('error', 'Connection failed. Please check your internet connection.');
          return;
        }
        throw userError;
      }
      if (!user) throw new Error('No authenticated user');

      // Create unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${contractId}/${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('contract-files')
        .upload(fileName, file);

      if (uploadError) {
        if (isConnectionError(uploadError)) {
          setConnectionError(true);
          addNotification('error', 'Upload failed due to connection issues. Please try again.');
          return;
        }
        throw uploadError;
      }

      // Save file metadata to database
      const { error: dbError } = await supabase
        .from('contract_files')
        .insert([
          {
            contract_id: contractId,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id,
            linked_contracts: []
          }
        ]);

      if (dbError) {
        if (isConnectionError(dbError)) {
          setConnectionError(true);
          addNotification('error', 'Failed to save file information due to connection issues.');
          return;
        }
        throw dbError;
      }

      // Refresh file list
      await fetchFiles();
      addNotification('success', `Successfully uploaded "${file.name}"`);
    } catch (error) {
      console.error('Error uploading file:', error);
      if (isConnectionError(error)) {
        setConnectionError(true);
        addNotification('error', 'Upload failed due to connection issues. Please check your internet connection.');
      } else {
        addNotification('error', `Failed to upload "${file.name}". Please try again.`);
      }
    } finally {
      setUploading(false);
    }
  };

  const linkDocument = async (sourceFileId: string) => {
    try {
      setConnectionError(false);
      // Get the source file details
      const { data: sourceFile, error: sourceError } = await supabase
        .from('contract_files')
        .select('*')
        .eq('id', sourceFileId)
        .single();

      if (sourceError) {
        if (isConnectionError(sourceError)) {
          setConnectionError(true);
          addNotification('error', 'Connection failed while linking document.');
          return;
        }
        throw sourceError;
      }

      // Update the source file to include this contract in linked_contracts
      const currentLinkedContracts = sourceFile.linked_contracts || [];
      const updatedLinkedContracts = [...currentLinkedContracts, contractId];

      const { error: updateError } = await supabase
        .from('contract_files')
        .update({
          linked_contracts: updatedLinkedContracts
        })
        .eq('id', sourceFileId);

      if (updateError) {
        if (isConnectionError(updateError)) {
          setConnectionError(true);
          addNotification('error', 'Connection failed while updating document link.');
          return;
        }
        throw updateError;
      }

      // Refresh file list
      await fetchFiles();
      setIsLinkModalOpen(false);
      addNotification('success', `Successfully linked "${sourceFile.file_name}"`);
    } catch (error) {
      console.error('Error linking document:', error);
      if (isConnectionError(error)) {
        setConnectionError(true);
        addNotification('error', 'Failed to link document due to connection issues.');
      } else {
        addNotification('error', 'Failed to link document. Please try again.');
      }
    }
  };

  const deleteFile = async (file: ContractFile, event: React.MouseEvent) => {
    // Prevent the click from bubbling up to the file preview
    event.stopPropagation();
    
    if (!confirm(`Are you sure you want to delete ${file.file_name}?`)) {
      return;
    }

    try {
      setConnectionError(false);
      const isOwner = file.contract_id === contractId;
      const isLinked = file.linked_contracts?.includes(contractId);

      if (isOwner) {
        // If this contract owns the file
        if (file.linked_contracts && file.linked_contracts.length > 0) {
          // File is linked to other contracts, need to find a valid contract to transfer ownership to
          let validLinkedContractId = null;
          
          // Check each linked contract to see if it still exists
          for (const linkedContractId of file.linked_contracts) {
            const { data: contractExists, error: contractCheckError } = await supabase
              .from('contracts')
              .select('id')
              .eq('id', linkedContractId)
              .single();

            if (!contractCheckError && contractExists) {
              validLinkedContractId = linkedContractId;
              break;
            }
          }

          if (validLinkedContractId) {
            // Transfer ownership to the first valid linked contract
            const updatedLinkedContracts = file.linked_contracts.filter(id => id !== validLinkedContractId);
            
            const { error: updateError } = await supabase
              .from('contract_files')
              .update({
                contract_id: validLinkedContractId,
                linked_contracts: updatedLinkedContracts
              })
              .eq('id', file.id);

            if (updateError) {
              if (isConnectionError(updateError)) {
                setConnectionError(true);
                addNotification('error', 'Connection failed while removing file.');
                return;
              }
              throw updateError;
            }
          } else {
            // No valid linked contracts found, delete the file completely
            const { error: storageError } = await supabase.storage
              .from('contract-files')
              .remove([file.file_path]);

            if (storageError && !isConnectionError(storageError)) {
              console.warn('Storage deletion failed:', storageError);
            }

            const { error: dbError } = await supabase
              .from('contract_files')
              .delete()
              .eq('id', file.id);

            if (dbError) {
              if (isConnectionError(dbError)) {
                setConnectionError(true);
                addNotification('error', 'Connection failed while deleting file.');
                return;
              }
              throw dbError;
            }
          }
        } else {
          // No other contracts using this file, delete completely
          const { error: storageError } = await supabase.storage
            .from('contract-files')
            .remove([file.file_path]);

          if (storageError && !isConnectionError(storageError)) {
            console.warn('Storage deletion failed:', storageError);
          }

          const { error: dbError } = await supabase
            .from('contract_files')
            .delete()
            .eq('id', file.id);

          if (dbError) {
            if (isConnectionError(dbError)) {
              setConnectionError(true);
              addNotification('error', 'Connection failed while deleting file.');
              return;
            }
            throw dbError;
          }
        }
      } else if (isLinked) {
        // This contract is just linked to the file, remove from linked_contracts
        const updatedLinkedContracts = file.linked_contracts?.filter(id => id !== contractId) || [];
        
        const { error: updateError } = await supabase
          .from('contract_files')
          .update({
            linked_contracts: updatedLinkedContracts
          })
          .eq('id', file.id);

        if (updateError) {
          if (isConnectionError(updateError)) {
            setConnectionError(true);
            addNotification('error', 'Connection failed while unlinking file.');
            return;
          }
          throw updateError;
        }
      }

      // Refresh file list
      await fetchFiles();
      addNotification('success', `Successfully removed "${file.file_name}"`);
    } catch (error) {
      console.error('Error deleting file:', error);
      if (isConnectionError(error)) {
        setConnectionError(true);
        addNotification('error', 'Failed to remove file due to connection issues.');
      } else {
        addNotification('error', `Failed to delete "${file.file_name}". Please try again.`);
      }
    }
  };

  const downloadFile = async (file: ContractFile, event: React.MouseEvent) => {
    // Prevent the click from bubbling up to the file preview
    event.stopPropagation();
    
    try {
      setConnectionError(false);
      const { data, error } = await supabase.storage
        .from('contract-files')
        .download(file.file_path);

      if (error) {
        if (isConnectionError(error)) {
          setConnectionError(true);
          addNotification('error', 'Download failed due to connection issues.');
          return;
        }
        if (isFileNotFoundError(error)) {
          // File not found in storage, clean up database entry
          await handleFileNotFound(file.id);
          return;
        }
        throw error;
      }

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      addNotification('success', `Downloaded "${file.file_name}"`);
    } catch (error) {
      if (isConnectionError(error)) {
        setConnectionError(true);
        addNotification('error', 'Download failed due to connection issues.');
      } else if (isFileNotFoundError(error)) {
        await handleFileNotFound(file.id);
      } else {
        // Only log non-file-not-found errors to console
        console.error('Error downloading file:', error);
        addNotification('error', `Failed to download "${file.file_name}". Please try again.`);
      }
    }
  };

  const handlePreviewFile = (file: ContractFile) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewFile(null);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      handleFiles(selectedFiles);
    }
    // Reset the input value so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFiles = (fileList: FileList) => {
    Array.from(fileList).forEach(file => {
      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];

      if (!allowedTypes.includes(file.type)) {
        addNotification('error', `File type ${file.type} is not supported. Please upload PDF, images, or Office documents.`);
        return;
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        addNotification('error', `File "${file.name}" is too large. Maximum size is 50MB.`);
        return;
      }

      uploadFile(file);
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500 mr-2" />;
    }
    return <File className="h-8 w-8 text-gray-500 mr-2" />;
  };

  const isFileLinked = (file: ContractFile) => {
    return file.contract_id !== contractId && file.linked_contracts?.includes(contractId);
  };

  const retryConnection = () => {
    setConnectionError(false);
    fetchFiles();
  };

  if (!contractId) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <p className="text-gray-500">Save the contract first to enable file uploads.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-40 space-y-2">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`flex items-center p-4 rounded-lg shadow-lg max-w-md ${
                notification.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : notification.type === 'warning'
                  ? 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              ) : notification.type === 'warning' ? (
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              )}
              <p className="text-sm font-medium flex-1">{notification.message}</p>
              <button
                onClick={() => removeNotification(notification.id)}
                className="ml-3 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Connection Error Banner */}
      {connectionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <WifiOff className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
              <p className="text-sm text-red-700 mt-1">
                Unable to connect to the server. Please check your internet connection and try again.
              </p>
              <button
                onClick={retryConnection}
                className="mt-2 inline-flex items-center text-sm text-red-600 hover:text-red-800 underline"
              >
                <Wifi className="h-4 w-4 mr-1" />
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Contract Documents</h3>
          {contractNumber && (
            <p className="text-sm text-gray-500">Contract: {contractNumber}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Supported: PDF, Images (JPG, PNG, GIF), Word, Excel • Max: 50MB • Click files to preview
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">{files.length} file(s)</span>
          <button
            onClick={() => setIsLinkModalOpen(true)}
            disabled={uploading || connectionError}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <Link className="h-4 w-4 mr-1" />
            Link Document
          </button>
          <button
            onClick={handleFileSelect}
            disabled={uploading || connectionError}
            className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white transition-colors ${
              uploading || connectionError
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
            }`}
          >
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
        />
      </div>

      {/* Files List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : files.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div 
              key={file.id} 
              className={`border rounded-lg p-4 hover:shadow-md hover:bg-blue-50 transition-all cursor-pointer group ${
                isFileLinked(file) ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50'
              }`}
              onClick={() => handlePreviewFile(file)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(file.mime_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
                      {file.file_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file_size)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(file.created_at).toLocaleDateString()}
                    </p>
                    {isFileLinked(file) && (
                      <p className="text-xs text-yellow-600 font-medium">
                        Linked Document
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  <button
                    onClick={(e) => downloadFile(file, e)}
                    disabled={connectionError}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-25"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => deleteFile(file, e)}
                    disabled={connectionError}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-25"
                    title={isFileLinked(file) ? "Unlink" : "Delete"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p>No files uploaded yet.</p>
          <p className="text-sm">Click the upload button above to add your first document.</p>
        </div>
      )}

      {/* Preview Modal */}
      <PreviewModal
        file={previewFile}
        isOpen={isPreviewOpen}
        onClose={closePreview}
        onFileNotFound={handleFileNotFound}
      />

      {/* Link Document Modal */}
      <LinkDocumentModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onLinkDocument={linkDocument}
        currentContractId={contractId}
      />
    </div>
  );
};

export default FileUploadSection;