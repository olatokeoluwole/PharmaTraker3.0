const fs = require('fs');

const oldCode = `const totalStock = Object.values(drug.branchStock || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);`;
const newCode = `const totalStock: number = Object.values(drug.branchStock || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0) as number;`;

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  if (code.includes(oldCode)) {
    code = code.replace(oldCode, newCode);
    fs.writeFileSync(filename, code);
    console.log("Patched " + filename);
  } else {
    console.log("Could not find exact string in " + filename);
  }
}

patchFile('src/components/DoctorView.tsx');
patchFile('src/components/HMOView.tsx');
