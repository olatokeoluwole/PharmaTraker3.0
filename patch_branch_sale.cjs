const fs = require('fs');
let code = fs.readFileSync('src/components/BranchView.tsx', 'utf8');

// 1. Insert "Sale" button at the top
const newHeader = `    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Branch Dashboard</h1>
        {!readOnly && (
          <button
            onClick={() => setShowDirectSaleModal(true)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            Sale
          </button>
        )}
      </div>`;
code = code.replace('<div className="flex flex-col gap-4">', newHeader);

// 2. Remove old "Direct / OTC Sale" button
const oldButton = `            {!readOnly && (
              <button
                onClick={() => setShowDirectSaleModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Direct / OTC Sale
              </button>
            )}`;
code = code.replace(oldButton, '');

// 3. Update Modal Title
code = code.replace('Direct / OTC Walk-in Sale', 'Sale');
code = code.replace('Sell directly at fixed administered selling rates', 'Record a new sale');

// 4. Update Submit Button text
code = code.replace("{isSubmittingDirectSale ? 'Logging Sale...' : 'Complete & Record Sale'}", "{isSubmittingDirectSale ? 'Processing...' : 'Purchase'}");

fs.writeFileSync('src/components/BranchView.tsx', code);
console.log("Patched BranchView!");
