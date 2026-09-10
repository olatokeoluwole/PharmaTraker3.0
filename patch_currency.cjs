const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsView.tsx', 'utf8');

code = code.replace(
  /const formatCurrency = \(val: number\) => `\$\$\{val\.toLocaleString\(undefined, \{ minimumFractionDigits: 2, maximumFractionDigits: 2 \}\}\}`;/,
  "const formatCurrency = (val: number) => `₦${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;"
);

code = code.replace(
  /tickFormatter=\{val => val >= 1000 \? `\$\$\{val\/1000\}k` : `\$\$\{val\}`\}/,
  "tickFormatter={val => val >= 1000 ? `₦${val/1000}k` : `₦${val}`}"
);

fs.writeFileSync('src/components/AnalyticsView.tsx', code);
console.log("Replaced currency symbols!");
