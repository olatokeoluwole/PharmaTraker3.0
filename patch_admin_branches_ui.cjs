const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const branchStateAndFuncs = `
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchEmail, setNewBranchEmail] = useState('');

  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      await addDoc(collection(db, 'branches'), {
        name: newBranchName,
        address: newBranchAddress,
        email: newBranchEmail,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchEmail('');
    } catch (err) {
      alert('Error adding branch: ' + err.message);
    }
  };

  const handleDeleteBranch = async (id) => {
    if (!window.confirm('Delete this branch?')) return;
    try {
      await deleteDoc(doc(db, 'branches', id));
    } catch(err) {
      alert('Error deleting branch: ' + err.message);
    }
  };
`;

code = code.replace(/const \[activeTab, setActiveTab\][^;]+;/, (match) => match + '\n' + branchStateAndFuncs);

const branchTabUI = `
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Register New Branch</h2>
            <form onSubmit={handleAddBranch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Branch Name (e.g. Branch C)"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newBranchEmail}
                  onChange={(e) => setNewBranchEmail(e.target.value)}
                  className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
              >
                Register Branch
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <h2 className="text-lg font-bold text-slate-800 p-4 border-b border-slate-100">Registered Branches</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Address</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-800">{b.name}</td>
                      <td className="p-4 text-slate-600">{b.address}</td>
                      <td className="p-4 text-slate-600">{b.email}</td>
                      <td className="p-4">
                        <button onClick={() => handleDeleteBranch(b.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {branches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">No branches registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(/\{activeTab === 'admin' && \(/, branchTabUI + "\n      {activeTab === 'admin' && (");

fs.writeFileSync('src/components/AdminView.tsx', code);
