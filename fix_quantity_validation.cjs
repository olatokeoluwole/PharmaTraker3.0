const fs = require('fs');

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  // Replace the alert message logic
  code = code.replace(
    /\(drugs\.find\(d => d\.id === selectedDrug\)\!\.branchQuantity \|\| 0\)/g,
    'getBranchStock(drugs.find(d => d.id === selectedDrug))'
  );
  
  fs.writeFileSync(filename, code);
  console.log("Patched " + filename);
}

patchFile('src/components/DoctorView.tsx');
patchFile('src/components/HMOView.tsx');
