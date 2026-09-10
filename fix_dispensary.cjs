const fs = require('fs');
let code = fs.readFileSync('src/components/DispensaryView.tsx', 'utf8');

code = code.replace(/export default function DispensaryView\([^\{]*\{/, (match) => {
  return match + "\n  const locId = profile.locationId || 'branch_a';\n";
});

code = code.replace(/drugData\.dispensaryQuantity/g, "drugData.branchStock?.[locId]");
code = code.replace(/drug\.dispensaryQuantity/g, "drug.branchStock?.[locId]");
code = code.replace(/drug\?\.dispensaryQuantity/g, "drug?.branchStock?.[locId]");
code = code.replace(/d\.dispensaryQuantity/g, "d.branchStock?.[locId]");
code = code.replace(/dispensaryQuantity: newQty/g, "['branchStock.' + locId]: newQty");

fs.writeFileSync('src/components/DispensaryView.tsx', code);
