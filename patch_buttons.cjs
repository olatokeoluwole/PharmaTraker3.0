const fs = require('fs');

function patchBrandColors(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Convert standard blue buttons to indigo
  content = content.replace(/bg-blue-600/g, 'bg-indigo-600');
  content = content.replace(/bg-blue-700/g, 'bg-indigo-700');
  
  // Convert blue highlights to indigo highlights
  content = content.replace(/text-blue-600/g, 'text-indigo-600');
  content = content.replace(/text-blue-700/g, 'text-indigo-700');
  content = content.replace(/bg-blue-100/g, 'bg-indigo-100');
  content = content.replace(/bg-blue-50/g, 'bg-indigo-50');
  content = content.replace(/border-blue-100/g, 'border-indigo-100');
  content = content.replace(/border-blue-200/g, 'border-indigo-200');
  content = content.replace(/border-blue-300/g, 'border-indigo-300');
  content = content.replace(/border-blue-400/g, 'border-indigo-400');
  content = content.replace(/text-blue-800/g, 'text-indigo-800');
  content = content.replace(/text-blue-900/g, 'text-indigo-900');

  // Convert generic slate backgrounds to stone/lighter neutral where applicable?
  // We'll just stick to standardizing the accent to Indigo.
  
  fs.writeFileSync(file, content);
}

const files = [
  'src/components/AdminView.tsx',
  'src/components/DoctorView.tsx',
  'src/components/HMOView.tsx',
  'src/components/BranchView.tsx',
  'src/components/StoreView.tsx',
  'src/components/FinanceView.tsx'
];

files.forEach(patchBrandColors);
