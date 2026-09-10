const fs = require('fs');

let code = fs.readFileSync('src/components/AnalyticsView.tsx', 'utf8');

// 1. Metric Cards
// Today Sales: Emerald
code = code.replace(
  /<div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-800">[\s\S]*?<TrendingUp className="w-5 h-5" \/>/,
  `<div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">\n              <TrendingUp className="w-5 h-5" />`
);
code = code.replace(
  /<h3 className="text-\[10px\] font-bold text-slate-500 uppercase tracking-wider">Today's Revenue<\/h3>[\s\S]*?<p className="text-2xl font-bold text-slate-800">/,
  `<h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today's Revenue</h3>\n            <p className="text-2xl font-bold text-emerald-950">`
);

// Monthly Sales: Blue
code = code.replace(
  /<div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-800">[\s\S]*?<LineChartIcon className="w-5 h-5" \/>/,
  `<div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">\n              <LineChartIcon className="w-5 h-5" />`
);
code = code.replace(
  /<h3 className="text-\[10px\] font-bold text-slate-500 uppercase tracking-wider">Monthly Revenue<\/h3>[\s\S]*?<p className="text-2xl font-bold text-slate-800">/,
  `<h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Monthly Revenue</h3>\n            <p className="text-2xl font-bold text-blue-950">`
);

// Gross Profit: Violet
code = code.replace(
  /<div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-800">[\s\S]*?<DollarSign className="w-5 h-5" \/>/,
  `<div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center text-violet-600">\n              <DollarSign className="w-5 h-5" />`
);
code = code.replace(
  /<h3 className="text-\[10px\] font-bold text-slate-500 uppercase tracking-wider">Gross Profit \(Today\)<\/h3>[\s\S]*?<p className="text-2xl font-bold text-slate-800">/,
  `<h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Profit (Today)</h3>\n            <p className="text-2xl font-bold text-violet-950">`
);

// Inventory Value: Amber
code = code.replace(
  /<div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-800">[\s\S]*?<Package className="w-5 h-5" \/>/,
  `<div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">\n              <Package className="w-5 h-5" />`
);
code = code.replace(
  /<h3 className="text-\[10px\] font-bold text-slate-500 uppercase tracking-wider">Total Inventory Value<\/h3>[\s\S]*?<p className="text-2xl font-bold text-slate-800">/,
  `<h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Inventory Value</h3>\n            <p className="text-2xl font-bold text-amber-950">`
);


// 2. Fix the "Bottom 10 Items" attention tag
code = code.replace(
  /<span className="text-\[8px\] font-bold bg-slate-100 border border-slate-200 px-1\.5 py-0\.5 text-slate-500 uppercase tracking-widest">Attention Required<\/span>/,
  `<span className="text-[8px] font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-rose-600 uppercase tracking-widest rounded-sm">Attention Required</span>`
);

// 3. Fix the Top 5 Categories list indicator
code = code.replace(
  /<div className="w-1\.5 h-1\.5 bg-slate-800 mr-2 rounded-sm"><\/div>/g,
  `<div className="w-1.5 h-1.5 bg-emerald-500 mr-2 rounded-full"></div>`
);


// 4. Update the chart color
code = code.replace(
  /<Bar dataKey="sales" fill="#1e293b"/,
  `<Bar dataKey="sales" fill="#4f46e5"`
);

// 5. Update payment type bars mapping
code = code.replace(
  /\{salesByPaymentType\.map\(\(pt, idx\) => \([\s\S]*?className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">[\s\S]*?<div className="h-full bg-slate-800" style=\{\{ width: \`\$\{pt\.value\}%\` \}\}/,
  `{salesByPaymentType.map((pt, idx) => {
              let barColor = 'bg-slate-500';
              if (pt.name.toLowerCase() === 'cash') barColor = 'bg-emerald-500';
              if (pt.name.toLowerCase() === 'card') barColor = 'bg-blue-500';
              if (pt.name.toLowerCase() === 'transfer') barColor = 'bg-indigo-500';
              if (pt.name.toLowerCase() === 'insurance') barColor = 'bg-amber-500';
              return (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-[9px] font-bold text-slate-500 uppercase w-16 text-right">{pt.name}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                  <div className={\`h-full \${barColor}\`} style={{ width: \`\${pt.value}%\` }}`
);
// Make sure to close the block since I changed it to a `{ return (` block
code = code.replace(
  /\}%\` \}\}>\S*<\/div>\s*<\/div>\s*<span className="text-\[10px\] font-bold text-slate-700 w-8 text-right">\{Math\.round\(pt\.value\)\}%\S*<\/span>\s*<\/div>\s*\)\)\}/,
  `}%\` }}></div>
                </div>
                <span className="text-[10px] font-bold text-slate-700 w-8 text-right">{Math.round(pt.value)}%</span>
              </div>
            );})}`
);


// 6. Make table headers slightly softer
code = code.replace(
  /text-slate-400 font-bold uppercase border-b border-slate-200/g,
  'text-slate-500 font-bold uppercase border-b border-slate-200'
);


fs.writeFileSync('src/components/AnalyticsView.tsx', code);
