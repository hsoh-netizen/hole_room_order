import React, { useState } from 'react';
import { X } from 'lucide-react';

function SidebarBtn({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
      <div className="flex items-center gap-3">{React.cloneElement(icon, { className: "w-5 h-5" })}<span>{label}</span></div>
      {badge > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{badge}</span>}
    </button>
  );
}
