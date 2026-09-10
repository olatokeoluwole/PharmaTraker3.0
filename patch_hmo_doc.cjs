const fs = require('fs');

const oldCode = `<td className={\`py-2 text-right font-bold \${(drug.branchStock?.[locId] || 0) > 0 ? 'text-emerald-600' : 'text-red-600'}\`}>
                      {(drug.branchStock?.[locId] || 0) > 0 ? \`\${drug.branchStock?.[locId] || 0} in stock\` : 'Out of Stock'}
                    </td>`;

const newCode = `<td className="py-2 text-right font-bold">
                      {(() => {
                        const totalStock = Object.values(drug.branchStock || {}).reduce((a, b) => a + (Number(b) || 0), 0);
                        return (
                          <span className={totalStock > 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {totalStock > 0 ? \`\${totalStock} in stock\` : 'Out of Stock'}
                          </span>
                        );
                      })()}
                    </td>`;

function patchFile(filename) {
  let code = fs.readFileSync(filename, 'utf8');
  if (code.includes(oldCode)) {
    code = code.replace(oldCode, newCode);
    fs.writeFileSync(filename, code);
    console.log("Patched " + filename);
  } else {
    console.log("Could not find exact string in " + filename);
  }
}

patchFile('src/components/DoctorView.tsx');
patchFile('src/components/HMOView.tsx');
