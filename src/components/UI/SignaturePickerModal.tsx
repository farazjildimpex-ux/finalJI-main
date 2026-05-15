import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, CheckCircle2, Upload, Loader2, PenLine } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import type { Signature } from '../../types';

export interface PickedSignature {
  id: string;
  name: string;
  imageUrl: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (sig: PickedSignature) => void;
}

const BUCKET = 'contract-files';

const SignaturePickerModal: React.FC<Props> = ({ isOpen, onClose, onSelect }) => {
  const { user } = useAuth();
  const [sigs, setSigs]           = useState<Signature[]>([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected]   = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [error, setError]           = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSigs = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('signatures')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setSigs((data as Signature[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) { fetchSigs(); setSelected(null); setShowUpload(false); setError(''); }
  }, [isOpen, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !user) { setError('Please provide a name and select an image.'); return; }
    setUploading(true);
    setError('');
    try {
      const ext  = uploadFile.name.split('.').pop() || 'png';
      const path = `signatures/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, uploadFile, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: dbErr } = await supabase.from('signatures').insert([{
        user_id:   user.id,
        name:      uploadName.trim(),
        image_url: publicUrl,
      }]);
      if (dbErr) throw dbErr;
      setUploadName('');
      setUploadFile(null);
      setPreviewUrl(null);
      setShowUpload(false);
      await fetchSigs();
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, imageUrl: string) => {
    try {
      const pathMatch = imageUrl.match(/contract-files\/(.+)$/);
      if (pathMatch) await supabase.storage.from(BUCKET).remove([pathMatch[1]]);
      await supabase.from('signatures').delete().eq('id', id);
      setSigs(prev => prev.filter(s => s.id !== id));
      if (selected === id) setSelected(null);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleConfirm = () => {
    const sig = sigs.find(s => s.id === selected);
    if (!sig) return;
    onSelect({ id: sig.id, name: sig.name, imageUrl: sig.image_url });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
              <PenLine className="h-4 w-4 text-rose-500" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Choose Signature</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Upload new */}
          {showUpload ? (
            <div className="border border-dashed border-rose-200 rounded-2xl p-4 bg-rose-50/40 space-y-3">
              <p className="text-sm font-bold text-slate-700">Upload New Signature</p>
              <input
                type="text"
                placeholder="Person's name (e.g. John Smith, Director)"
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="preview" className="h-20 object-contain rounded-xl bg-white border border-gray-200 p-2" />
                  <button onClick={() => { setPreviewUrl(null); setUploadFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                    className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow text-gray-400 hover:text-red-500 flex items-center justify-center text-xs">✕</button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-rose-300 hover:text-rose-500 transition-colors">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs font-semibold">Click to upload PNG / JPG</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleUpload} disabled={uploading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl disabled:opacity-60 transition-colors">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Saving…' : 'Save Signature'}
                </button>
                <button onClick={() => { setShowUpload(false); setError(''); }}
                  className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 rounded-xl transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowUpload(true)}
              className="w-full flex items-center gap-2.5 px-4 py-3 border border-dashed border-rose-200 rounded-2xl text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors">
              <Plus className="h-4 w-4" />
              Upload New Signature
            </button>
          )}

          {/* Signature list */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
          ) : sigs.length === 0 ? (
            <div className="text-center py-8">
              <PenLine className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-400">No signatures saved yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Upload one above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sigs.map(sig => (
                <div key={sig.id}
                  onClick={() => setSelected(sig.id)}
                  className={`group relative flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all
                    ${selected === sig.id ? 'border-rose-400 bg-rose-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}
                >
                  <div className="h-14 w-28 flex-shrink-0 bg-white rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden">
                    <img src={sig.image_url} alt={sig.name} className="max-h-12 max-w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{sig.name}</p>
                  </div>
                  {selected === sig.id && (
                    <CheckCircle2 className="h-5 w-5 text-rose-500 flex-shrink-0" />
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(sig.id, sig.image_url); }}
                    className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-white opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={!selected}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl disabled:opacity-40 transition-colors">
            Use This Signature
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePickerModal;
