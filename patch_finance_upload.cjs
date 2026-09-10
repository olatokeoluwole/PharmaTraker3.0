const fs = require('fs');
let code = fs.readFileSync('src/components/FinanceView.tsx', 'utf8');

code = code.replace(
  "   Plus, Trash2, Calendar, Filter, Download,",
  "   Plus, Trash2, Calendar, Filter, Download, Upload,"
);

fs.writeFileSync('src/components/FinanceView.tsx', code);
