const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// Add the HMO tab state type
code = code.replace(
  /const \[activeTab, setActiveTab\] = useState<'admin' \| 'finance' \| 'store' \| 'branch' \| 'doctor' \| 'expiry' \| 'branches' \| 'branch_transactions'>\('admin'\);/,
  "const [activeTab, setActiveTab] = useState<'admin' | 'finance' | 'store' | 'branch' | 'doctor' | 'hmo' | 'expiry' | 'branches' | 'branch_transactions'>('admin');"
);

// Add the button
const buttonRegex = /<button\s+className=\{`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors \$\{\s*activeTab === 'doctor' \? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'\s*\}`\}\s+onClick=\{\(\) => setActiveTab\('doctor'\)\}\s*>\s*Doctor View \(Read Only\)\s*<\/button>/;

const newButton = `<button
          className={\`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors \${
            activeTab === 'doctor' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('doctor')}
        >
          Doctor View (Read Only)
        </button>

        <button
          className={\`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors \${
            activeTab === 'hmo' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('hmo')}
        >
          HMO View (Read Only)
        </button>`;

code = code.replace(buttonRegex, newButton);

// Render the HMOView component
const renderRegex = /\{activeTab === 'doctor' && <DoctorView profile=\{profile\} readOnly=\{true\} \/>\}/;

const newRender = `{activeTab === 'doctor' && <DoctorView profile={profile} readOnly={true} />}
      {activeTab === 'hmo' && <HMOView profile={profile} readOnly={true} />}`;

code = code.replace(renderRegex, newRender);

fs.writeFileSync('src/components/AdminView.tsx', code);
console.log("Patched AdminView with HMO tab!");
