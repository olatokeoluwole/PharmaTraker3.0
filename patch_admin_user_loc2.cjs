const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const locationHandler = `
  const handleLocationChange = async (userId, isRegistered, email, locationId) => {
    try {
      const emailKey = (email || '').trim().toLowerCase();
      
      if (isRegistered && userId) {
        await setDoc(doc(db, 'users', userId), { locationId, updatedAt: Date.now() }, { merge: true });
      }
      
      if (emailKey) {
        const matchingUsers = users.filter(u => (u.email || '').trim().toLowerCase() === emailKey);
        for (const mu of matchingUsers) {
          await setDoc(doc(db, 'users', mu.id), { locationId, updatedAt: Date.now() }, { merge: true });
        }
        await setDoc(doc(db, 'staff_roles', emailKey), { locationId, updatedAt: Date.now() }, { merge: true });
      }
    } catch (err) {
      alert('Error updating location: ' + err.message);
    }
  };
`;

code = code.replace(/const handleRoleChange =/, locationHandler + '\n  const handleRoleChange =');

const locSelectInRow = `
                              {currentRole === 'branch' && (
                                <select
                                  value={u.locationId || ''}
                                  onChange={(e) => handleLocationChange(u.id, u.isRegistered, u.email, e.target.value)}
                                  className="p-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium cursor-pointer shadow-sm ml-2"
                                >
                                  <option value="">Select Branch</option>
                                  {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              )}
`;

code = code.replace(/<\/select>(\s*)<button/g, '</select>' + locSelectInRow + '$1<button');

fs.writeFileSync('src/components/AdminView.tsx', code);
