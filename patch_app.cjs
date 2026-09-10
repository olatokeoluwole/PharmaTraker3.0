const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const applyRoleIfFound = \(assignedRole: Role\) => \{\s*if \(assignedRole && assignedRole !== 'pending'\) \{\s*setDoc\(userRef, \{ role: assignedRole \}, \{ merge: true \}\)\.catch\(\(\) => \{\}\);\s*setProfile\(prev => prev \? \{ \.\.\.prev, role: assignedRole \} : null\);\s*\}\s*\};/g,
  `const applyDataIfFound = (data: any) => {
      const assignedRole = data?.role as Role;
      if (assignedRole && assignedRole !== 'pending') {
        const payload: any = { role: assignedRole };
        if (data.locationId) payload.locationId = data.locationId;
        setDoc(userRef, payload, { merge: true }).catch(() => {});
        setProfile(prev => prev ? { ...prev, ...payload } : null);
      }
    };`
);

code = code.replace(/applyRoleIfFound\(staffSnap\.data\(\)\?\.role as Role\);/g, 'applyDataIfFound(staffSnap.data());');
code = code.replace(/applyRoleIfFound\(userSnap\.data\(\)\?\.role as Role\);/g, 'applyDataIfFound(userSnap.data());');

code = code.replace(
  'setDoc(docRef, { role: assignedRole, email: userEmail }, { merge: true }).catch(() => {});',
  'setDoc(docRef, { role: assignedRole, email: userEmail, ...(staffData?.locationId ? {locationId: staffData.locationId} : {}) }, { merge: true }).catch(() => {});'
);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App!");
