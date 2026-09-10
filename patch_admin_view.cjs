const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// 1. Add Import to AdminView
code = code.replace(
  "import AnalyticsView from './AnalyticsView';",
  "import AnalyticsView from './AnalyticsView';\nimport ImportDrugsModal from './ImportDrugsModal';"
);

// 2. Add state for Import Modal
code = code.replace(
  "  const [newDrugCategory, setNewDrugCategory] = useState('');",
  "  const [newDrugCategory, setNewDrugCategory] = useState('');\n  const [isImportModalOpen, setIsImportModalOpen] = useState(false);"
);

// 3. Add Import Modal button to the Control Unit header
code = code.replace(
  "                <h2 className=\"font-bold text-slate-700 uppercase text-xs flex items-center\">\n                  <Package className=\"w-4 h-4 mr-2\" />\n                  Control Unit (Admin)\n                </h2>\n                <span className=\"px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold\">Supply Chain</span>",
  `                <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  Control Unit (Admin)
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setIsImportModalOpen(true)} className="px-2 py-1 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded text-[10px] font-bold flex items-center transition-colors">
                    Import CSV
                  </button>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">Supply Chain</span>
                </div>`
);

// 4. Add the Import Modal component before the final return closing div
const finalReturnIndex = code.lastIndexOf("    </div>\n  );\n}");
code = code.slice(0, finalReturnIndex) + `      <ImportDrugsModal \n        isOpen={isImportModalOpen} \n        onClose={() => setIsImportModalOpen(false)} \n        onSuccess={() => {\n          setIsImportModalOpen(false);\n          alert('Inventory data imported successfully!');\n        }}\n      />\n` + code.slice(finalReturnIndex);

fs.writeFileSync('src/components/AdminView.tsx', code);
