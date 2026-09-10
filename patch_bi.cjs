const fs = require('fs');
let code = fs.readFileSync('src/components/AnalyticsView.tsx', 'utf8');

code = code.replace(
  /const paymentMap: Record<string, number> = \{\s*'insurance': 0,\s*'credit': 0,\s*'cash': 0,\s*'pos': 0\s*\};/,
  `const paymentMap: Record<string, number> = {
      'insurance': 0,
      'card': 0,
      'cash': 0,
      'transfer': 0,
      'other': 0
    };`
);

code = code.replace(
  /\/\/ Mock payment type based on branch\/id since actual payment type isn't tracked in dispensing records yet\s*\/\/ A quick hack to populate the chart\s*const hash = \(d\.id \|\| ''\)\.charCodeAt\(0\) % 4;\s*if \(hash === 0\) paymentMap\.insurance \+= rev;\s*else if \(hash === 1\) paymentMap\.credit \+= rev;\s*else if \(hash === 2\) paymentMap\.cash \+= rev;\s*else paymentMap\.pos \+= rev;/,
  `const method = (d.paymentMethod || 'cash').toLowerCase();
      if (method === 'insurance') paymentMap.insurance += rev;
      else if (method === 'card' || method === 'pos') paymentMap.card += rev;
      else if (method === 'transfer') paymentMap.transfer += rev;
      else if (method === 'cash') paymentMap.cash += rev;
      else paymentMap.other += rev;`
);

code = code.replace(
  /const salesByPaymentType = \[\s*\{ name: 'INSURANCE', value: totalPayments \? \(paymentMap\.insurance \/ totalPayments\) \* 100 : 0 \},\s*\{ name: 'CREDIT', value: totalPayments \? \(paymentMap\.credit \/ totalPayments\) \* 100 : 0 \},\s*\{ name: 'CASH', value: totalPayments \? \(paymentMap\.cash \/ totalPayments\) \* 100 : 0 \},\s*\{ name: 'POS', value: totalPayments \? \(paymentMap\.pos \/ totalPayments\) \* 100 : 0 \},\s*\]\.sort\(\(a, b\) => b\.value - a\.value\);/,
  `const salesByPaymentType = [
      { name: 'INSURANCE', value: totalPayments ? (paymentMap.insurance / totalPayments) * 100 : 0 },
      { name: 'CARD', value: totalPayments ? (paymentMap.card / totalPayments) * 100 : 0 },
      { name: 'CASH', value: totalPayments ? (paymentMap.cash / totalPayments) * 100 : 0 },
      { name: 'TRANSFER', value: totalPayments ? (paymentMap.transfer / totalPayments) * 100 : 0 },
      { name: 'OTHER', value: totalPayments ? (paymentMap.other / totalPayments) * 100 : 0 },
    ].sort((a, b) => b.value - a.value);`
);

fs.writeFileSync('src/components/AnalyticsView.tsx', code);
console.log("Patched BI");
