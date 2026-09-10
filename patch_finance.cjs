const fs = require('fs');
let code = fs.readFileSync('src/components/FinanceView.tsx', 'utf8');

code = code.replace(
  "import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';",
  "import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';\nimport ImportSalesModal from './ImportSalesModal';\nimport ImportExpensesModal from './ImportExpensesModal';"
);

code = code.replace(
  "  const [financeTab, setFinanceTab] = useState<'overview'",
  "  const [isImportSalesModalOpen, setIsImportSalesModalOpen] = useState(false);\n  const [isImportExpensesModalOpen, setIsImportExpensesModalOpen] = useState(false);\n  const [financeTab, setFinanceTab] = useState<'overview'"
);

code = code.replace(
  "              <p className=\"text-[11px] text-slate-500\">Every sales transaction recorded through the branch and prescription fulfillment</p>\n            </div>\n            <div className=\"w-full sm:w-auto\">",
  `              <p className="text-[11px] text-slate-500">Every sales transaction recorded through the branch and prescription fulfillment</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setIsImportSalesModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-semibold flex items-center transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import CSV
              </button>`
);

code = code.replace(
  "              <p className=\"text-[11px] text-slate-500\">Track and manage non-inventory operational expenditures</p>\n            </div>\n            <div className=\"flex flex-wrap items-center gap-2 w-full sm:w-auto\">",
  `              <p className="text-[11px] text-slate-500">Track and manage non-inventory operational expenditures</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setIsImportExpensesModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-semibold flex items-center transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import CSV
              </button>`
);

// Add the modals before the final closing div.
// The component is large, so finding the last `</div>\n  );\n}` should work.
const finalReturnIndex = code.lastIndexOf("    </div>\n  );\n}");
code = code.slice(0, finalReturnIndex) + 
`      <ImportSalesModal
        isOpen={isImportSalesModalOpen}
        onClose={() => setIsImportSalesModalOpen(false)}
        onSuccess={() => {
          setIsImportSalesModalOpen(false);
          alert('Past sales records imported successfully!');
        }}
        drugs={drugs}
      />
      <ImportExpensesModal
        isOpen={isImportExpensesModalOpen}
        onClose={() => setIsImportExpensesModalOpen(false)}
        onSuccess={() => {
          setIsImportExpensesModalOpen(false);
          alert('Past expenses imported successfully!');
        }}
        profile={profile}
      />\n` + 
code.slice(finalReturnIndex);

fs.writeFileSync('src/components/FinanceView.tsx', code);
