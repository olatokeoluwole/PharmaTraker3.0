const fs = require('fs');
let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

// 1. Add branches state
code = code.replace(/const \[dispenseRecords, setDispenseRecords\] = useState<DispenseRecord\[\]>\(\[\]\);/,
`const [dispenseRecords, setDispenseRecords] = useState<DispenseRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);`);

// 2. Add branches subscription
code = code.replace(/const qDispenses = query/,
`const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const qDispenses = query`);

// 3. Unsubscribe branches
code = code.replace(/unsubDrugs\(\);\n\s*unsubDispenses\(\);/,
`unsubDrugs();
      unsubDispenses();
      unsubBranches();`);

// 4. Resolve branch name
code = code.replace(/const locId = profile\.locationId \|\| 'branch_a';/,
`const locId = profile.locationId || 'unknown_branch';
  const resolvedBranchName = branches.find(b => b.id === locId)?.name || 'Unknown Branch';`);

// 5. Replace branchId and branchName in addDoc calls
code = code.replace(/branchId: profile\.id/g, 'branchId: locId');
code = code.replace(/branchName: profile\.name/g, 'branchName: resolvedBranchName');

fs.writeFileSync('src/components/BranchView.tsx', code);
