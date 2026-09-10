const fs = require('fs');

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  // 1. Add branches state and selectedBranchId
  code = code.replace(
    /const \[search, setSearch\] = useState\(''\);/,
    `const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');`
  );

  // 2. Fetch branches in useEffect
  if (!code.includes("const unsubBranches")) {
    code = code.replace(
      /const unsubPrescriptions = onSnapshot\(/,
      `const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    const unsubPrescriptions = onSnapshot(`
    );
    code = code.replace(
      /unsubPrescriptions\(\);/,
      `unsubBranches();
      unsubPrescriptions();`
    );
  }

  // 3. Update getBranchStock
  code = code.replace(
    /const getBranchStock = \(d\?: Drug\) => \{\s*if \(\!d\) return 0;\s*return Object\.entries\(d\.branchStock \|\| \{\}\)\s*\.filter\(\(\[key\]\) => key !== 'central'\)\s*\.reduce\(\(a: number, \[_, b\]: any\) => a \+ \(Number\(b\) \|\| 0\), 0\) as number;\s*\};/,
    `const getBranchStock = (d?: Drug) => {
    if (!d) return 0;
    if (selectedBranchId) {
      return Number(d.branchStock?.[selectedBranchId] || 0);
    }
    return Object.entries(d.branchStock || {})
      .filter(([key]) => key !== 'central')
      .reduce((a: number, [_, b]: any) => a + (Number(b) || 0), 0) as number;
  };`
  );

  // 4. Add dropdown in UI next to search
  code = code.replace(
    /<div className="relative w-full sm:w-56 mt-2 sm:mt-0">/,
    `<div className="relative w-full sm:w-auto mt-2 sm:mt-0 flex gap-2">
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedDrug(''); // Reset selected drug when branch changes
              }}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-600"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="relative w-full sm:w-56">`
  );
  
  code = code.replace(
    /className="w-full pl-8 pr-2 py-1\.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"/,
    `className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"
            />
            </div>`
  );

  // Remove the old closing div for the search
  code = code.replace(
    /className="w-full pl-8 pr-2 py-1\.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"[\s\S]*?\/>\s*<\/div>\s*<\/div>\s*<\/div>/,
    `className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"
            />
            </div>
          </div>
        </div>`
  );

  // 5. Update Prescription Payload to include targetBranchId
  code = code.replace(
    /quantity,\s*status: 'pending',/,
    `quantity,
        status: 'pending',
        targetBranchId: selectedBranchId || null,`
  );
  
  // 6. Require branch selection in the dropdown
  code = code.replace(
    /<option value="">-- Select Medication --<\/option>/,
    `<option value="">{selectedBranchId ? "-- Select Medication --" : "-- Select a Branch First --"}</option>`
  );
  
  code = code.replace(
    /<select\s*required\s*value=\{selectedDrug\}/,
    `<select
                    required
                    disabled={!selectedBranchId}
                    value={selectedDrug}`
  );
  
  // 7. Update display in select options (d.branchStock?.[locId] replaced by getBranchStock(d))
  code = code.replace(
    /d\.branchStock\?\.\[locId\] \|\| 0/g,
    `getBranchStock(d)`
  );

  fs.writeFileSync(filename, code);
  console.log("Patched " + filename);
}

patchFile('src/components/DoctorView.tsx');
patchFile('src/components/HMOView.tsx');
