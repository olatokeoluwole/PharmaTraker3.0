const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(/dispensaryId: string;/g, 'branchId: string;');
code = code.replace(/dispensaryName: string;/g, 'branchName: string;');
fs.writeFileSync('src/types.ts', code);
