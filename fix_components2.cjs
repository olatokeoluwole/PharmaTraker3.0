const fs = require('fs');

const files = ['DoctorView.tsx', 'DispensaryView.tsx', 'StoreView.tsx'];
for (const file of files) {
  let code = fs.readFileSync('src/components/' + file, 'utf8');
  code = code.replace(/\{  const locId = profile\.locationId \|\| '[^']+'; /, '{ ');
  code = code.replace(/\{  const locId = profile\.locationId \|\| '[^']+';\n  const \[targetLocation, setTargetLocation\] = useState\('branch_a'\); /, '{ ');
  fs.writeFileSync('src/components/' + file, code);
}
