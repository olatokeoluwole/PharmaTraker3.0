const fs = require('fs');
let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

code = code.replace(/const locId = profile.locationId \|\| 'unknown_branch';\n  const resolvedBranchName = branches.find\(b => b.id === locId\)\?.name \|\| 'Unknown Branch';/, 'const locId = profile.locationId || \'unknown_branch\';');
code = code.replace(/const \[branches, setBranches\] = useState<any\[\]>\(\[\]\);/, 'const [branches, setBranches] = useState<any[]>([]);\n  const resolvedBranchName = branches.find(b => b.id === locId)?.name || \'Unknown Branch\';');

fs.writeFileSync('src/components/BranchView.tsx', code);
