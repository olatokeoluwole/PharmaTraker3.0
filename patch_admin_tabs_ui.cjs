const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// Insert new tabs in the header
const newTabs = `
          <button
            onClick={() => setActiveTab('branches')}
            className={\`pb-3 px-1 border-b-2 font-medium text-sm transition-colors \${
            activeTab === 'branches' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }\`}
          >
            Branches
          </button>
          <button
            onClick={() => setActiveTab('branch_transactions')}
            className={\`pb-3 px-1 border-b-2 font-medium text-sm transition-colors \${
            activeTab === 'branch_transactions' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
            }\`}
          >
            Branch Transactions
          </button>
`;

code = code.replace(/<button\s*onClick=\{\(\) => setActiveTab\('expiry'\)\}/, newTabs + "\n          <button\n            onClick={() => setActiveTab('expiry')}");

fs.writeFileSync('src/components/AdminView.tsx', code);
