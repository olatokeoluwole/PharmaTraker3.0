const fs = require('fs');

let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

// 1. Update locId definition
code = code.replace(
  /const locId = readOnly && selectedBranchId \? selectedBranchId : \(profile\.locationId \|\| 'unknown_branch'\);/,
  `const locId = readOnly ? selectedBranchId : (profile.locationId || '');
  
  const getBranchStock = (d: Drug) => {
    if (!locId) {
      return Object.values(d.branchStock || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;
    }
    return Number(d.branchStock?.[locId] || 0);
  };`
);

// 2. Update filteredDispenses logic
code = code.replace(
  /const filteredDispenses = locId === 'unknown_branch' \? dispenseRecords : dispenseRecords\.filter\(d => !locId \|\| d\.branchId === locId\);/,
  `const filteredDispenses = !locId ? dispenseRecords : dispenseRecords.filter(d => d.branchId === locId);`
);

// 3. Replace all instances of `(d.branchStock?.[locId] || 0)` with `getBranchStock(d)`
code = code.replace(/\(d\.branchStock\?\.\[locId\] \|\| 0\)/g, 'getBranchStock(d)');
code = code.replace(/drug\?\.branchStock\?\.\[locId\] \|\| 0/g, 'getBranchStock(drug)');
code = code.replace(/drug\.branchStock\?\.\[locId\] \|\| 0/g, 'getBranchStock(drug)');

fs.writeFileSync('src/components/BranchView.tsx', code);
console.log("Patched BranchView completely");
