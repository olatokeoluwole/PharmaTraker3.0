const fs = require('fs');
let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

code = code.replace(/export default function DispensaryView/g, 'export default function BranchView');
code = code.replace(/DispensaryView/g, 'BranchView');
code = code.replace(/dispensaryName/g, 'branchName');
code = code.replace(/dispensaryId/g, 'branchId');
code = code.replace(/dispensary/g, 'branch');
code = code.replace(/Dispensary/g, 'Branch');
fs.writeFileSync('src/components/BranchView.tsx', code);
