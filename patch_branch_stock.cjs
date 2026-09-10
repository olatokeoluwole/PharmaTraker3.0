const fs = require('fs');

let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

code = code.replace(
  /const getBranchStock = \(d: Drug\) => \{/,
  `const getBranchStock = (d?: Drug) => {
    if (!d) return 0;`
);

fs.writeFileSync('src/components/BranchView.tsx', code);
console.log("Patched getBranchStock in BranchView");
