const fs = require('fs');
let code = fs.readFileSync('src/firebase.ts', 'utf8');

code = code.replace(
  "import { getFirestore } from 'firebase/firestore';",
  "import { getFirestore, initializeFirestore } from 'firebase/firestore';"
);

code = code.replace(
  "export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);",
  "export const db = initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId);"
);

fs.writeFileSync('src/firebase.ts', code);
