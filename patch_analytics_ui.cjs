const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsView.tsx', 'utf8');

// Replace today's sales percentage
code = code.replace(
  /<span className="text-\[10px\] flex items-center bg-green-50 text-green-700 px-1 py-0\.5 font-bold mb-1 border border-green-100">[\s\S]*?<TrendingUp className="w-3 h-3 mr-0\.5" \/> 5\.2%[\s\S]*?<\/span>/,
  `<span className={\`text-[10px] flex items-center px-1 py-0.5 font-bold mb-1 border \${todaySalesChange >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}\`}>
              {todaySalesChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(todaySalesChange).toFixed(1)}%
            </span>`
);

// Replace monthly sales percentage
code = code.replace(
  /<span className="text-\[10px\] flex items-center bg-red-50 text-red-700 px-1 py-0\.5 font-bold mb-1 border border-red-100">[\s\S]*?<TrendingDown className="w-3 h-3 mr-0\.5" \/> 1\.8%[\s\S]*?<\/span>/,
  `<span className={\`text-[10px] flex items-center px-1 py-0.5 font-bold mb-1 border \${monthlySalesChange >= 0 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-700 border-red-100'}\`}>
              {monthlySalesChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(monthlySalesChange).toFixed(1)}%
            </span>`
);

fs.writeFileSync('src/components/AnalyticsView.tsx', code);
