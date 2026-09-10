const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsView.tsx', 'utf8');

// 1. Add date-fns imports
code = code.replace(
  "import { isToday, isThisMonth, parseISO, format, getHours } from 'date-fns';",
  "import { isToday, isYesterday, isThisMonth, isSameMonth, subMonths, parseISO, format, getHours } from 'date-fns';"
);

// 2. Add variables to useMemo destructuring
code = code.replace(
  "    todaySales,\n    monthlySales,\n    grossProfitMargin,",
  "    todaySales,\n    monthlySales,\n    todaySalesChange,\n    monthlySalesChange,\n    grossProfitMargin,"
);

// 3. Add variables inside useMemo
code = code.replace(
  "    let todaySales = 0;\n    let monthlySales = 0;\n    let totalRevenue = 0;",
  "    let todaySales = 0;\n    let yesterdaySales = 0;\n    let monthlySales = 0;\n    let lastMonthSales = 0;\n    let totalRevenue = 0;"
);

// 4. Update dispenses loop
code = code.replace(
  "      const isTm = isThisMonth(date);\n      const rev = d.totalAmount || 0;\n      \n      if (isTd) todaySales += rev;\n      if (isTm) monthlySales += rev;",
  `      const isTm = isThisMonth(date);
      const isYd = isYesterday(date);
      const isLm = isSameMonth(date, subMonths(new Date(), 1));
      const rev = d.totalAmount || 0;
      
      if (isTd) todaySales += rev;
      if (isYd) yesterdaySales += rev;
      if (isTm) monthlySales += rev;
      if (isLm) lastMonthSales += rev;`
);

// 5. Add percentage calculation before return
code = code.replace(
  "    return {\n      todaySales,",
  `    const todaySalesChange = yesterdaySales === 0 ? (todaySales > 0 ? 100 : 0) : ((todaySales - yesterdaySales) / yesterdaySales) * 100;
    const monthlySalesChange = lastMonthSales === 0 ? (monthlySales > 0 ? 100 : 0) : ((monthlySales - lastMonthSales) / lastMonthSales) * 100;
    
    return {
      todaySales,
      todaySalesChange,
      monthlySalesChange,`
);

fs.writeFileSync('src/components/AnalyticsView.tsx', code);
