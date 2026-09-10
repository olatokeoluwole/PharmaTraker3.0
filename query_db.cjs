const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'ai-studio-c6876d47-c5ba-4626-b78d-f50ad982f364' });
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').get();
  users.forEach(u => console.log('USER:', u.id, u.data()));
  
  const staff = await db.collection('staff_roles').get();
  staff.forEach(s => console.log('STAFF:', s.id, s.data()));
}
run();
