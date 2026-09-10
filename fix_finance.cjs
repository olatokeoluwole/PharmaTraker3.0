const fs = require('fs');
let code = fs.readFileSync('src/components/FinanceView.tsx', 'utf8');

code = code.replace(/d\.storeQuantity/g, "d.branchStock?.['central']");
code = code.replace(/d\.dispensaryQuantity/g, "(Object.values(d.branchStock || {}).reduce((a, b) => a + b, 0) - (d.branchStock?.['central'] || 0))");
code = code.replace(/drug\.storeQuantity/g, "drug.branchStock?.['central']");
code = code.replace(/drug\.dispensaryQuantity/g, "(Object.values(drug.branchStock || {}).reduce((a, b) => a + b, 0) - (drug.branchStock?.['central'] || 0))");

fs.writeFileSync('src/components/FinanceView.tsx', code);
