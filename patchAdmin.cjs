const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

code = code.replace(
  /const \[newDrugCategory, setNewDrugCategory\] = useState<'medication' \| 'consumable'>\('medication'\);/g,
  "const [newDrugCategory, setNewDrugCategory] = useState('');"
);

code = code.replace(
  /if \(!newDrugName\.trim\(\)\) return;/g,
  "if (!newDrugName.trim() || !newDrugCategory.trim()) return;"
);

code = code.replace(
  /setNewDrugCategory\('medication'\);/g,
  "setNewDrugCategory('');"
);

const selectRegex = /<select[\s\S]*?value=\{newDrugCategory\}[\s\S]*?<\/select>/;
const inputReplacement = `<input
                        type="text"
                        required
                        value={newDrugCategory}
                        onChange={e => setNewDrugCategory(e.target.value)}
                        placeholder="Category (compulsory)"
                        className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400"
                      />`;

code = code.replace(selectRegex, inputReplacement);

fs.writeFileSync('src/components/AdminView.tsx', code);
console.log("Patched!");
