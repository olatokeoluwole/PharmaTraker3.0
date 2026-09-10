const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

code = code.replace(
  /useState<'admin' \| 'finance' \| 'store' \| 'branch' \| 'doctor' \| 'hmo' \| 'expiry' \| 'branches' \| 'branch_transactions'>/g,
  "useState<'admin' | 'finance' | 'analytics' | 'store' | 'branch' | 'doctor' | 'hmo' | 'expiry' | 'branches' | 'branch_transactions'>"
);

// add import AnalyticsView from './AnalyticsView'; if not exists
if (!code.includes("import AnalyticsView")) {
  code = code.replace("import FinanceView from './FinanceView';", "import FinanceView from './FinanceView';\nimport AnalyticsView from './AnalyticsView';");
}

code = code.replace(
  /        <button\n          className={`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1\.5 whitespace-nowrap transition-colors \$\{\n            activeTab === 'finance' \? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-700'\n          \}`}\n          onClick=\{() => setActiveTab\('finance'\)\}\n        >\n          <DollarSign className="w-3\.5 h-3\.5" \/>\n          Finance\n        <\/button>/,
  `        <button
          className={\`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap transition-colors \${
            activeTab === 'finance' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('finance')}
        >
          <DollarSign className="w-3.5 h-3.5" />
          Finance
        </button>
        <button
          className={\`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap transition-colors \${
            activeTab === 'analytics' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart className="w-3.5 h-3.5" />
          Analytics
        </button>`
);

code = code.replace(
  /      \{\/\* TAB: Financial Management \*\/\}/,
  `      {/* TAB: Analytics Dashboard */}
      {activeTab === 'analytics' && (
        <AnalyticsView
          profile={profile}
          drugs={drugs}
          purchases={purchases}
          dispenses={dispenses}
        />
      )}

      {/* TAB: Financial Management */}`
);

fs.writeFileSync('src/components/AdminView.tsx', code);
console.log("Patched AdminView.tsx with analytics tab!");
