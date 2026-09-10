const fs = require('fs');

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  code = code.replace(
    /const pending = prescriptions\.filter\(p => p\.status === 'pending'\);/,
    `const pending = prescriptions.filter(p => p.status === 'pending' && (!p.targetBranchId || !locId || p.targetBranchId === locId));`
  );
  
  code = code.replace(
    /const dispensed = prescriptions\.filter\(p => p\.status === 'dispensed'\);/,
    `const dispensed = prescriptions.filter(p => p.status === 'dispensed' && (!p.targetBranchId || !locId || p.targetBranchId === locId));`
  );

  fs.writeFileSync(filename, code);
  console.log("Patched " + filename);
}

patchFile('src/components/BranchView.tsx');
