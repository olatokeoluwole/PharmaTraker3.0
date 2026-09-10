const code = require('fs').readFileSync('src/components/AdminView.tsx', 'utf8');
const matches = [...code.matchAll(/newDrugCategory/g)];
console.log(matches.map(m => m.index));
