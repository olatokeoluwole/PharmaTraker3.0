const fs = require('fs');
let code = fs.readFileSync('src/components/StoreView.tsx', 'utf8');

const alertBanner = `
      {/* Global Low-Stock Alerts */}
      {drugs.filter(d => Object.values(d.branchStock || {}).reduce((a, b) => a + b, 0) <= 20).length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm leading-5 font-medium text-red-800">
                Global Low-Stock Alert
              </h3>
              <div className="mt-2 text-sm leading-5 text-red-700">
                <p>The following items are running low across the ENTIRE chain and require central restocking:</p>
                <ul className="list-disc pl-5 mt-1">
                  {drugs.filter(d => Object.values(d.branchStock || {}).reduce((a, b) => a + b, 0) <= 20).map(d => (
                    <li key={d.id}>{d.name} ({Object.values(d.branchStock || {}).reduce((a, b) => a + b, 0)} remaining globally)</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(/<div className="flex flex-col gap-4">/, '<div className="flex flex-col gap-4">' + alertBanner);
fs.writeFileSync('src/components/StoreView.tsx', code);
