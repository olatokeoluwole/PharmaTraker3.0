const fs = require('fs');

let layout = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// App background
layout = layout.replace('bg-slate-100 text-slate-900', 'bg-[#FAFAFA] text-slate-900');

// Header background
layout = layout.replace('bg-slate-900', 'bg-indigo-950 border-b border-indigo-900/50');

// Logo background and text
layout = layout.replace('bg-blue-500 rounded flex items-center justify-center font-bold text-xl', 'bg-indigo-600/20 rounded flex items-center justify-center font-bold text-xl border border-indigo-500/30');
layout = layout.replace('<Activity className="w-5 h-5 text-white" />', '<Activity className="w-5 h-5 text-indigo-400" />');
layout = layout.replace('text-slate-400 font-light', 'text-indigo-300/70 font-light');

// User Role accents
layout = layout.replace(/text-blue-400/g, 'text-indigo-400');
layout = layout.replace('bg-slate-700', 'bg-indigo-800/50');
layout = layout.replace('text-slate-300 font-normal', 'text-indigo-100 font-normal');

// Sign out button
layout = layout.replace('text-slate-400 hover:text-white', 'text-indigo-300 hover:text-white');

fs.writeFileSync('src/components/Layout.tsx', layout);
