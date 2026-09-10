const fs = require('fs');
let code = fs.readFileSync('src/components/DoctorView.tsx', 'utf8');

const regex = /<td className=\{\`py-2 text-right font-bold \$\{\(drug\.branchStock\?\.\[locId\] \|\| 0\) > 0 \? 'text-emerald-600' : 'text-red-600'\}\`\}>\s*\{\(drug\.branchStock\?\.\[locId\] \|\| 0\) > 0 \? \`\\\$\{\(drug\.branchStock\?\.\[locId\] \|\| 0\)\} in stock\` : 'Out of Stock'\}\s*<\/td>/g;

const replacement = `<td className="py-2 text-right font-bold">
                      {(() => {
                        const totalStock = Object.values(drug.branchStock || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                        return (
                          <span className={totalStock > 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {totalStock > 0 ? \`\${totalStock} in stock\` : 'Out of Stock'}
                          </span>
                        );
                      })()}
                    </td>`;

code = code.replace(regex, replacement);
fs.writeFileSync('src/components/DoctorView.tsx', code);
console.log("Patched DoctorView");
