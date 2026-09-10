const fs = require('fs');
let code = fs.readFileSync('src/components/HMOView.tsx', 'utf8');

code = code.replace(/'Prescription authorized and sent to branch\.'/g, "'Order authorized and sent to branch.'");
code = code.replace(/'Error creating prescription'/g, "'Error creating order'");
code = code.replace(/\{\/\* Create Prescription Form \*\/\}/g, "{/* Create Order Form */}");
code = code.replace(/\{\/\* Prescription History \*\/\}/g, "{/* Order History */}");
code = code.replace(/Recent Prescriptions/g, "Recent Orders");
code = code.replace(/No prescriptions issued yet\./g, "No orders issued yet.");

fs.writeFileSync('src/components/HMOView.tsx', code);
console.log("Patched HMOView texts!");
