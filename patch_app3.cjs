const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /role: isSuperAdmin \? 'admin' : 'pending'/g,
  "role: 'pending'"
);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx role fallback!");
