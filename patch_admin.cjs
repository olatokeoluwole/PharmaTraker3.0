const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

code = code.replace(
  /\{record\.drugs \? record\.drugs\.map\(\(d: any\) => \`\$\{d\.drugName\} \(x\$\{d\.quantity\}\)\`\)\.join\(\', \'\) : \(record\.drugName \+ \' \(x\' \+ record\.quantity \+ \'\)\)\}/,
  "{record.drugs ? record.drugs.map((d: any) => `${d.drugName} (x${d.quantity})`).join(', ') : (record.drugName + ' (x' + (record.quantityDispensed || record.quantity || 0) + ')')}"
);

code = code.replace(
  /\{\(record\.totalCost \|\| 0\)\.toLocaleString\(\)\}/,
  `{(() => {
                        let total = record.totalAmount;
                        if (total === undefined || total === null || total === 0) {
                          const unitPrice = record.unitPrice || drugs.find(d => d.id === record.drugId)?.sellingPrice || 0;
                          total = unitPrice * (record.quantityDispensed || record.quantity || 0);
                        }
                        return total.toLocaleString();
                      })()}`
);

fs.writeFileSync('src/components/AdminView.tsx', code);
console.log("Patched Admin");
