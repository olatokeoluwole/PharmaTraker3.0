const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// Add state for staffLocationId
code = code.replace(/const \[staffRole, setStaffRole\] = useState<Role>\('doctor'\);/, 
  "const [staffRole, setStaffRole] = useState<Role>('doctor');\n  const [staffLocationId, setStaffLocationId] = useState('');");

// Update handleAddStaff to save locationId
code = code.replace(/role: staffRole,(\s*)createdAt:/, "role: staffRole, locationId: staffRole === 'branch' ? staffLocationId : '',$1createdAt:");

// Update handleRoleChange to save locationId (wait, handleRoleChange parameters)
// Let's modify handleRoleChange signature if we can find it.
// Actually, in the users list, we can just show the Location dropdown if role is branch.

// Insert the Location select in the form
const locSelect = `
                  {staffRole === 'branch' && (
                    <select
                      required
                      value={staffLocationId}
                      onChange={e => setStaffLocationId(e.target.value)}
                      className="w-full sm:w-36 p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                    >
                      <option value="">Select Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
`;

code = code.replace(/<button(\s*)type="submit"(\s*)disabled=\{isRegisteringStaff\}/, locSelect + '\n                  <button$1type="submit"$2disabled={isRegisteringStaff}');

fs.writeFileSync('src/components/AdminView.tsx', code);
