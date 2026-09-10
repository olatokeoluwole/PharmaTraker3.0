const fs = require('fs');
let code = fs.readFileSync('src/components/DoctorView.tsx', 'utf8');

code = code.replace(/export default function DoctorView\([^\{]*\{/, (match) => {
  return match + "\n  const locId = profile.locationId || 'branch_a';\n";
});

code = code.replace(/drug\.dispensaryQuantity/g, "drug.branchStock?.[locId]");
code = code.replace(/d\.dispensaryQuantity/g, "d.branchStock?.[locId]");
code = code.replace(/dispensaryQuantity: newQty/g, "['branchStock.' + locId]: newQty");

fs.writeFileSync('src/components/DoctorView.tsx', code);
