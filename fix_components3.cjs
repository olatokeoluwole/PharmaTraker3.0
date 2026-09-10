const fs = require('fs');
const files = ['DoctorView.tsx', 'DispensaryView.tsx', 'StoreView.tsx'];
for (const file of files) {
  let code = fs.readFileSync('src/components/' + file, 'utf8');
  code = code.replace(/\{\s*const locId = [^\;]+\;\s*/, '{ ');
  code = code.replace(/\{\s*const \[targetLocation[^;]+;\s*/, '{ ');
  fs.writeFileSync('src/components/' + file, code);
}
