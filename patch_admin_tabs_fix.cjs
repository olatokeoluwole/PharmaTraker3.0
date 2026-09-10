const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// Find the admin tab button and append the BI View button after it
const adminTabRegex = /<button\s+className=\{`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1\.5 whitespace-nowrap transition-colors \$\{\s*activeTab === 'admin' \? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'\s*\}`\}\s+onClick=\{[^}]+\}\s*>\s*<Package[^>]+>\s*Admin Dashboard\s*<\/button>/m;

if (adminTabRegex.test(code)) {
  code = code.replace(adminTabRegex, (match) => {
    return match + `
        <button
          className={\`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap transition-colors \${
            activeTab === 'analytics' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'
          }\`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          BI View
        </button>`;
  });
  console.log("Patched tab bar successfully.");
} else {
  console.log("Could not find admin tab button.");
}

fs.writeFileSync('src/components/AdminView.tsx', code);
