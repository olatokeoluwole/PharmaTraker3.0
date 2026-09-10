const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

code = code.replace(
  "{record.drugs ? record.drugs.map((d: any) => `${d.drugName} (x${d.quantity})`).join(', ') : (record.drugName + ' (x' + record.quantity + ')')}",
  "{record.drugs ? record.drugs.map((d: any) => `${d.drugName} (x${d.quantity})`).join(', ') : (record.drugName + ' (x' + (record.quantityDispensed || record.quantity || 0) + ')')}"
);

fs.writeFileSync('src/components/AdminView.tsx', code);
