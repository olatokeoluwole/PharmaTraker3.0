const fs = require('fs');
let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

code = code.replace(
  "const locId = profile.locationId || 'unknown_branch';",
  `const [selectedBranchId, setSelectedBranchId] = useState(profile.locationId || '');
  const locId = readOnly && selectedBranchId ? selectedBranchId : (profile.locationId || 'unknown_branch');`
);

code = code.replace(
  '<div className="flex flex-col gap-4">',
  `<div className="flex flex-col gap-4">
      {readOnly && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <label className="text-sm font-bold text-slate-700">View Branch:</label>
          <select 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600 font-medium"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            <option value="">-- Select a Branch --</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}`
);

fs.writeFileSync('src/components/BranchView.tsx', code);
console.log("Patched BranchView!");
