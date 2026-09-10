const fs = require('fs');

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  // Insert helper function if not exists
  if (!code.includes('const getBranchStock =')) {
    code = code.replace(
      /const \[search, setSearch\] = useState\(''\);/,
      `const [search, setSearch] = useState('');
  
  const getBranchStock = (d: Drug) => {
    return Object.entries(d.branchStock || {})
      .filter(([key]) => key !== 'central')
      .reduce((a: number, [_, b]: any) => a + (Number(b) || 0), 0) as number;
  };`
    );
  }

  // Replace totalStock in table
  const oldCode1 = `const totalStock: number = Object.entries(drug.branchStock || {})
                          .filter(([key]) => key !== 'central')
                          .reduce((a: number, [_, b]: any) => a + (Number(b) || 0), 0) as number;`;
  if (code.includes(oldCode1)) {
    code = code.replace(oldCode1, `const totalStock = getBranchStock(drug);`);
  }

  // Replace dropdown stock
  code = code.replace(/\(d\.branchStock\?\.\[locId\] \|\| 0\)/g, 'getBranchStock(d)');
  
  fs.writeFileSync(filename, code);
  console.log("Patched " + filename);
}

patchFile('src/components/DoctorView.tsx');
patchFile('src/components/HMOView.tsx');
