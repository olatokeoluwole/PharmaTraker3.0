const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const regex1 = /role: explicitRole,\s*isRegistered: true\s*\}\);/g;
const replacement1 = `role: explicitRole,
        isRegistered: true,
        locationId: u.locationId || staffEntry?.locationId
      });`;

const regex2 = /role: explicitRole,\s*isRegistered: false\s*\}\);/g;
const replacement2 = `role: explicitRole,
          isRegistered: false,
          locationId: staff.locationId
        });`;

code = code.replace(regex1, replacement1);
code = code.replace(regex2, replacement2);

fs.writeFileSync('src/components/AdminView.tsx', code);
console.log("Patched combinedUsers!");
