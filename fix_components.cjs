const fs = require('fs');

const files = ['DoctorView.tsx', 'DispensaryView.tsx', 'StoreView.tsx'];
for (const file of files) {
  let code = fs.readFileSync('src/components/' + file, 'utf8');
  // First, remove the bad injection
  code = code.replace(/\{  const locId =[^;]+;/, '{');
  code = code.replace(/\{  const \[targetLocation[^;]+;/, '{');
  
  // Now inject after the proper `) {`
  code = code.replace(/profile: UserProfile, readOnly\?: boolean \}\) \{/, (match) => {
     let inject = "\n  const locId = profile.locationId || '" + (file === 'StoreView.tsx' ? 'central' : 'branch_a') + "';\n";
     if (file === 'StoreView.tsx') {
        inject += "  const [targetLocation, setTargetLocation] = useState('branch_a');\n";
     }
     return match + inject;
  });
  fs.writeFileSync('src/components/' + file, code);
}
