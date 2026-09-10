const fs = require('fs');
let code = fs.readFileSync('src/components/StoreView.tsx', 'utf8');

code = code.replace(/const \[transfers, setTransfers\] = useState<InterBranchTransfer\[\]>\(\[\]\);/, 
  "const [transfers, setTransfers] = useState<InterBranchTransfer[]>([]);\n  const [branches, setBranches] = useState<any[]>([]);");

code = code.replace(/const unsubTransfers = onSnapshot/,
  `const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });\n    const unsubTransfers = onSnapshot`);

code = code.replace(/return \(\) => \{\s*unsubDrugs\(\);\s*unsubTransfers\(\);\s*\};/,
  "return () => {\n      unsubDrugs();\n      unsubTransfers();\n      unsubBranches();\n    };");

const selectUI = `
                  <select
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 bg-white"
                  >
                    <option value="">Select Target Location</option>
                    <option value="central">Central Warehouse</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
`;

code = code.replace(/<select[\s\S]*?<\/select>/, selectUI);

code = code.replace(/const handleTransfer = async \(e: React\.FormEvent\) => \{/, 
  "const handleTransfer = async (e: React.FormEvent) => {\n    if (!targetLocation) return;");

fs.writeFileSync('src/components/StoreView.tsx', code);
