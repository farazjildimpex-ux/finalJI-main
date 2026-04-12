import React from 'react';
import { Clipboard } from 'lucide-react';

const NotesPage: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center">
          <Clipboard className="h-8 w-8 text-blue-600 mr-2" />
          <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
        </div>
        <p className="mt-2 text-gray-600">Keep track of important information</p>
      </div>
      
      {/* Placeholder content */}
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500">The Notes feature will be implemented in a future update.</p>
      </div>
    </div>
  );
};

export default NotesPage;