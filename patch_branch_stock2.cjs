const fs = require('fs');

let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

code = code.replace(
  /return Object\.values\(d\.branchStock \|\| \{\}\)\.reduce\(\(a: number, b: any\) => a \+ \(Number\(b\) \|\| 0\), 0\) as number;/,
  `return Object.entries(d.branchStock || {})
        .filter(([key]) => key !== 'central')
        .reduce((a: number, [_, b]: any) => a + (Number(b) || 0), 0) as number;`
);

fs.writeFileSync('src/components/BranchView.tsx', code);
console.log("Patched getBranchStock in BranchView");
