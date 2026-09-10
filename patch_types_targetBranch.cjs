const fs = require('fs');

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  
  code = code.replace(
    /status: 'pending' \| 'dispensed';/,
    `status: 'pending' | 'dispensed';\n  targetBranchId?: string;`
  );

  fs.writeFileSync(filename, code);
  console.log("Patched " + filename);
}

patchFile('src/types.ts');
