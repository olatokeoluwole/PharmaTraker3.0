const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const displayLoc = `
                            </span>
                            {currentRole === 'branch' && u.locationId && (
                              <span className="ml-2 text-[10px] text-slate-500 font-medium">
                                {branches.find(b => b.id === u.locationId)?.name || u.locationId}
                              </span>
                            )}
`;

code = code.replace(/<\/span>(\s*)<\/td>(\s*)<td className="px-4 py-3 text-right">/g, displayLoc + '$1</td>$2<td className="px-4 py-3 text-right">');

fs.writeFileSync('src/components/AdminView.tsx', code);
