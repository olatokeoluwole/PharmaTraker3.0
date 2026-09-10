const fs = require('fs');

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  code = code.replace(
    /const getBranchStock = \(d: Drug\) => \{\s*return Object\.entries\(d\.branchStock \|\| \{\}\)\s*\.filter\(\(\[key\]\) => key !== 'central'\)\s*\.reduce\(\(a: number, \[_, b\]: any\) => a \+ \(Number\(b\) \|\| 0\), 0\) as number;\s*\};/,
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
  
  fs.writeFileSync(filename, code);
  console.log("Patched " + filename);
}

patchFile('src/components/DoctorView.tsx');
patchFile('src/components/HMOView.tsx');
