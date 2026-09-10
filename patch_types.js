const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code = code.replace(
`  storeQuantity: number;
  dispensaryQuantity: number;`,
`  branchStock: { [locationId: string]: number };`
);

code = code.replace(
`  role: Role;
}`,
`  role: Role;
  locationId?: string;
}`
);

const locationsCode = `
export const PHARMACY_LOCATIONS = [
  { id: 'central', name: 'Central Warehouse', type: 'warehouse' },
  { id: 'branch_a', name: 'Branch A', type: 'branch' },
  { id: 'branch_b', name: 'Branch B', type: 'branch' },
];

export interface InterBranchTransfer {
  id: string;
  drugId: string;
  drugName: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  createdAt: number;
  updatedAt: number;
}
`;

code = code + locationsCode;
fs.writeFileSync('src/types.ts', code);
