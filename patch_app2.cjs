const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// I will remove isSuperAdmin from ALL effectiveRole logic to make it purely db-driven!
code = code.replace(
  /let effectiveRole: Role = isSuperAdmin \? 'admin' : 'pending';[\s\S]*?if \(docSnap\.exists\(\)\) \{[\s\S]*?const data = docSnap\.data\(\);[\s\S]*?displayName = data\.name \|\| displayName;[\s\S]*?if \(data\.role\) \{[\s\S]*?effectiveRole = data\.role as Role;[\s\S]*?\} else if \(isSuperAdmin\) \{[\s\S]*?effectiveRole = 'admin';[\s\S]*?\}[\s\S]*?\}/g,
  `let effectiveRole: Role = 'pending';
          let displayName = currentUser.displayName || userEmail.split('@')[0];

          if (docSnap.exists()) {
            const data = docSnap.data();
            displayName = data.name || displayName;
            if (data.role) {
              effectiveRole = data.role as Role;
            }
          }
          
          if (effectiveRole === 'pending' && isSuperAdmin) {
            effectiveRole = 'admin';
          }`
);

// Allow staffRoleUnsub for superadmin too so changes sync smoothly
code = code.replace(/if \(\!isSuperAdmin && userEmail\) \{/g, "if (userEmail) {");

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx further!");
