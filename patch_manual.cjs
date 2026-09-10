const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `      if (assignedRole !== 'pending') {
        await setDoc(userRef, { role: assignedRole }, { merge: true });
        setProfile(prev => prev ? { ...prev, role: assignedRole } : null);
      } else {`,
  `      if (assignedRole !== 'pending') {
        const payload: any = { role: assignedRole };
        if (staffSnap.exists() && staffSnap.data().locationId) payload.locationId = staffSnap.data().locationId;
        else if (userSnap.exists() && userSnap.data().locationId) payload.locationId = userSnap.data().locationId;
        
        await setDoc(userRef, payload, { merge: true });
        setProfile(prev => prev ? { ...prev, ...payload } : null);
      } else {`
);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched Manual Check!");
