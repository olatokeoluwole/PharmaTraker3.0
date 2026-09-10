const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsView.tsx', 'utf8');

// 1. Add monthlyCostOfGoods to variables
code = code.replace(
  "    let totalCostOfGoods = 0;",
  "    let totalCostOfGoods = 0;\n    let monthlyCostOfGoods = 0;"
);

// 2. Accumulate monthly COGS inside the dispenses loop
code = code.replace(
  "        totalCostOfGoods += (drug.costPrice || 0) * d.quantityDispensed;",
  "        totalCostOfGoods += (drug.costPrice || 0) * d.quantityDispensed;\n        if (isTm) monthlyCostOfGoods += (drug.costPrice || 0) * d.quantityDispensed;"
);

// 3. Update Margin calculation to use monthly instead of all-time
code = code.replace(
  "    // Margins\n    const grossProfitVal = totalRevenue - totalCostOfGoods;\n    const grossProfitMargin = totalRevenue > 0 ? (grossProfitVal / totalRevenue) * 100 : 0;",
  "    // Margins (Current Month)\n    const grossProfitVal = monthlySales - monthlyCostOfGoods;\n    const grossProfitMargin = monthlySales > 0 ? (grossProfitVal / monthlySales) * 100 : 0;"
);

fs.writeFileSync('src/components/AnalyticsView.tsx', code);
