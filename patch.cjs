const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const target = `        <button
          className={\`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors \${
            activeTab === 'store' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('store')}
        >
          Store View (Read Only)
        </button>`;

const replacement = `        <button
          className={\`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors flex items-center gap-1.5 \${
            activeTab === 'branches' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('branches')}
        >
          Branches
        </button>
        <button
          className={\`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors flex items-center gap-1.5 \${
            activeTab === 'branch_transactions' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('branch_transactions')}
        >
          Branch Transactions
        </button>
        <button
          className={\`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors \${
            activeTab === 'store' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('store')}
        >
          Store View (Read Only)
        </button>`;

if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/components/AdminView.tsx', code);
    console.log("Patched successfully!");
} else {
    console.log("Failed to patch: Target not found.");
}
