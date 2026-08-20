[diff]
*** Begin Patch
*** Update File: src/components/Sales/LeadDetailsModal.tsx
@@
-const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-white transition-colors';
-const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5';
+const inputCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white transition-colors';
+const labelCls = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5';
@@
-    <div className="fixed inset-0 z-[60] flex flex-col sm:items-center sm:justify-center sm:p-6">
-      {/* backdrop — desktop only */}
-      <div className="hidden sm:block fixed inset-0 bg-black/50" onClick={onClose} />
-      <div className="relative z-10 flex-1 sm:flex-none w-full sm:max-w-2xl sm:max-h-[90vh] bg-white sm:rounded-3xl sm:shadow-2xl flex flex-col overflow-hidden">
+    <div className="fixed inset-0 z-[60] flex flex-col sm:items-center sm:justify-center sm:p-6">
+      {/* backdrop — desktop only */}
+      <div className="hidden sm:block fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
+      <div className="relative z-10 flex-1 sm:flex-none w-full sm:max-w-2xl sm:max-h-[90vh] bg-white sm:rounded-3xl sm:shadow-2xl flex flex-col overflow-hidden">
@@
-        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
+        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 flex-shrink-0">
@@
-            <h2 className="text-base font-bold text-slate-900">
+            <h2 className="text-base font-black text-slate-900">
               {lead ? 'Edit Lead' : 'New Lead'}
             </h2>
@@
-        {lead && (
-          <div className="flex items-center gap-1 px-5 py-2 border-b border-gray-100 flex-shrink-0">
+        {lead && (
+          <div className="flex items-center gap-1 px-5 py-2 border-b border-slate-100 flex-shrink-0">
@@
-                <button onClick={() => setActiveTab('details')} className={tabCls(activeTab === 'details')}>Details</button>
+                <button onClick={() => setActiveTab('details')} className={tabCls(activeTab === 'details')}>Details</button>
                 <button onClick={() => setActiveTab('calls')}   className={tabCls(activeTab === 'calls')}>
                   Calls {callLogs.length > 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{callLogs.length}</span>}
                 </button>
                 <button onClick={() => setActiveTab('emails')}  className={tabCls(activeTab === 'emails')}>
                   Emails {emailLogs.length > 0 && <span className="ml-1 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5">{emailLogs.length}</span>}
                 </button>
-          </div>
+          </div>
         )}
@@
-        <div className="flex-1 overflow-y-auto p-6">
+        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
@@
-              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
+              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
@@
-                  <label className={labelCls}>Company Name *</label>
-                  <input type="text" value={formData.company_name || ''} onChange={e => setFormData({ ...formData, company_name: e.target.value })} className={inputCls} placeholder="Acme Leather [...]
+                  <label className={labelCls}>Company Name *</label>
+                  <input type="text" value={formData.company_name || ''} onChange={e => setFormData({ ...formData, company_name: e.target.value })} className={inputCls} placeholder="Acme Leather" />
                 </div>
@@
-                  <label className={labelCls}>Contact Person *</label>
-                  <input type="text" value={formData.contact_person || ''} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} className={inputCls} placeholder="John Smit[...]
+                  <label className={labelCls}>Contact Person *</label>
+                  <input type="text" value={formData.contact_person || ''} onChange={e => setFormData({ ...formData, contact_person: e.target.value })} className={inputCls} placeholder="John Smith" />
                 </div>
@@
-                  <label className={labelCls}>Industry Focus</label>
-                  <input type="text" value={formData.industry_focus || ''} onChange={e => setFormData({ ...formData, industry_focus: e.target.value })} className={inputCls} placeholder="Footwear,[...]
+                  <label className={labelCls}>Industry Focus</label>
+                  <input type="text" value={formData.industry_focus || ''} onChange={e => setFormData({ ...formData, industry_focus: e.target.value })} className={inputCls} placeholder="Footwear, Automotive" />
                 </div>
@@
-                <div>
-                  <label className={labelCls}>Address</label>
-                  <div className="space-y-2">
-                    {(formData.address?.length ? formData.address : ['']).map((addr, i) => (
-                      <div key={i} className="flex gap-2">
-                        <input
-                          type="text"
-                          value={addr}
-                          onChange={e => handleArrayChange('address', i, e.target.value)}
-                          className={inputCls}
-                          placeholder={`Line ${i + 1}`}
-                        />
-                        {i > 0 && (
-                          <button onClick={() => removeArrayField('address', i)} className="w-9 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 tra[...]
-                            <Minus className="h-4 w-4" />
-                          </button>
-                        )}
-                      </div>
-                    ))}
-                    <button onClick={() => addArrayField('address')} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
-                      <Plus className="h-3.5 w-3.5" /> Add line
-                    </button>
-                  </div>
-                </div>
+                <div>
+                  <label className={labelCls}>Address</label>
+                  <div className="space-y-2">
+                    {(formData.address?.length ? formData.address : ['']).map((addr, i) => (
+                      <div key={i} className="flex gap-2">
+                        <input
+                          type="text"
+                          value={addr}
+                          onChange={e => handleArrayChange('address', i, e.target.value)}
+                          className={inputCls}
+                          placeholder={`Line ${i + 1}`}
+                        />
+                        {i > 0 && (
+                          <button onClick={() => removeArrayField('address', i)} className="w-9 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
+                            <Minus className="h-4 w-4" />
+                          </button>
+                        )}
+                      </div>
+                    ))}
+                    <button onClick={() => addArrayField('address')} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
+                      <Plus className="h-3.5 w-3.5" /> Add line
+                    </button>
+                  </div>
+                </div>
*** End Patch
