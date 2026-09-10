const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// 1. Add branches state
code = code.replace(/const \[users, setUsers\] = useState<UserProfile\[\]>\(\[\]\);/, "const [users, setUsers] = useState<UserProfile[]>([]);\n  const [branches, setBranches] = useState<any[]>([]);");

// 2. Add branches listener
code = code.replace(/const unsubUsers = onSnapshot\(collection\(db, 'users'\)/,
`const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });\n\n    const unsubUsers = onSnapshot(collection(db, 'users')`);

// 3. Add unsubscribe
code = code.replace(/unsubUsers\(\);\n\s*unsubPurchases\(\);/, "unsubUsers();\n      unsubBranches();\n      unsubPurchases();");

// 4. Update the activeTab state type to include 'branches' and 'branch_transactions'
code = code.replace(/useState<'admin' \| 'finance' \| 'store' \| 'branch' \| 'doctor' \| 'expiry'>/, "useState<'admin' | 'finance' | 'store' | 'branch' | 'doctor' | 'expiry' | 'branches' | 'branch_transactions'>");

fs.writeFileSync('src/components/AdminView.tsx', code);
