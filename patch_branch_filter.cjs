const fs = require('fs');

let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

// Use a regex to modify how filtered records are generated
const replacement = `const filteredDispenses = locId === 'unknown_branch' ? dispenseRecords : dispenseRecords.filter(d => !locId || d.branchId === locId);
  const pending = prescriptions.filter(p => p.status === 'pending');
  const dispensed = prescriptions.filter(p => p.status === 'dispensed');

  // Calculate today's sales income recorded by branch
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayDispenses = filteredDispenses.filter(d => d.createdAt >= todayStart.getTime());`;

code = code.replace(
  /const pending = prescriptions\.filter\(p => p\.status === 'pending'\);\s*const dispensed = prescriptions\.filter\(p => p\.status === 'dispensed'\);\s*\/\/ Calculate today's sales income recorded by branch\s*const todayStart = new Date\(\);\s*todayStart\.setHours\(0, 0, 0, 0\);\s*const todayDispenses = dispenseRecords\.filter\(d => d\.createdAt >= todayStart\.getTime\(\)\);/g,
  replacement
);

code = code.replace(
  /dispenseRecords\.length/g,
  `filteredDispenses.length`
);

code = code.replace(
  /dispenseRecords\.slice\(0, 15\)\.map/g,
  `filteredDispenses.slice(0, 15).map`
);

fs.writeFileSync('src/components/BranchView.tsx', code);
console.log("Patched BranchView");
