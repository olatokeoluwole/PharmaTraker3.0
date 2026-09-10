const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsView.tsx', 'utf8');

code = code.replace(
  /=> `\$\$\{val\.toLocaleString/g,
  "=> `₦${val.toLocaleString"
);

fs.writeFileSync('src/components/AnalyticsView.tsx', code);
console.log("Replaced currency symbols properly!");
