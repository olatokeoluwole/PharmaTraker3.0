const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const txStateAndFuncs = `
  const [dispenseRecords, setDispenseRecords] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    if (activeTab === 'branch_transactions') {
      const q = query(collection(db, 'dispense_records'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, snap => {
        setDispenseRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    }
  }, [activeTab]);
`;

code = code.replace(/const \[newBranchName, setNewBranchName\] = useState\(''\);/, txStateAndFuncs + '\n  const [newBranchName, setNewBranchName] = useState(\'\');');

const branchTxTabUI = `
      {activeTab === 'branch_transactions' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800">Branch Transactions</h2>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Item(s)</th>
                  <th className="p-3 text-right">Total (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispenseRecords
                  .filter(r => !selectedBranchId || r.branchId === selectedBranchId)
                  .map(record => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{new Date(record.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-medium text-slate-700">{record.branchName || 'Unknown Branch'}</td>
                    <td className="p-3 text-slate-700">{record.patientName || 'Direct Sale'}</td>
                    <td className="p-3 text-slate-600">
                      {record.drugs ? record.drugs.map((d: any) => \`\${d.drugName} (x\${d.quantity})\`).join(', ') : (record.drugName + ' (x' + record.quantity + ')')}
                    </td>
                    <td className="p-3 text-right font-medium text-slate-800">
                      {(record.totalCost || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {dispenseRecords.filter(r => !selectedBranchId || r.branchId === selectedBranchId).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
`;

code = code.replace(/\{activeTab === 'branches' && \(/, branchTxTabUI + "\n      {activeTab === 'branches' && (");

fs.writeFileSync('src/components/AdminView.tsx', code);
