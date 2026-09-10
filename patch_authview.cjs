const fs = require('fs');
let code = fs.readFileSync('src/components/AuthView.tsx', 'utf8');

code = code.replace(
  /let assignedRole: Role = 'pending';\s*if \(userEmail\.toLowerCase\(\) === 'oreloretechcustomerservice@gmail\.com' \|\| userEmail\.toLowerCase\(\) === 'olatokeoluwole@gmail\.com'\) \{\s*return 'admin';\s*\}/g,
  `let assignedRole: Role = 'pending';
    const isSuperAdmin = userEmail.toLowerCase() === 'oreloretechcustomerservice@gmail.com' || userEmail.toLowerCase() === 'olatokeoluwole@gmail.com';`
);

code = code.replace(
  /if \(staffSnap\.exists\(\)\) \{\s*assignedRole = staffSnap\.data\(\)\.role as Role;\s*\}/g,
  `if (staffSnap.exists() && staffSnap.data().role) {
        assignedRole = staffSnap.data().role as Role;
      }`
);

code = code.replace(
  /return assignedRole;\s*\};\s*const handleGoogleLogin = async \(\) => \{/g,
  `if (assignedRole === 'pending' && isSuperAdmin) {
      return 'admin';
    }
    return assignedRole;
  };

  const handleGoogleLogin = async () => {`
);

fs.writeFileSync('src/components/AuthView.tsx', code);
console.log("Patched AuthView.tsx!");
