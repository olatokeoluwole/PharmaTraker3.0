const fs = require('fs');
let code = fs.readFileSync('src/components/StoreView.tsx', 'utf8');

code = code.replace(/export default function StoreView\([^\{]*\{/, (match) => {
  return match + "\n  const locId = profile.locationId || 'central';\n  const [targetLocation, setTargetLocation] = useState('branch_a');\n";
});

code = code.replace(/InternalTransferRecord/g, "InterBranchTransfer");
code = code.replace(/internal_transfers/g, "inter_branch_transfers");

code = code.replace(/const storeQty = [^;]+;/, "const storeQty = drug.branchStock?.[locId] || 0;");
code = code.replace(/storeUserId: profile.id,[\s\S]*?drugName: drug\.name,/, 
`requestedBy: profile.id,
        requestedByName: profile.name,
        drugId: drug.id,
        drugName: drug.name,
        fromLocationId: locId,
        toLocationId: targetLocation,
        status: 'approved',
        updatedAt: Date.now(),`);

code = code.replace(/const payload[\s\S]*?await updateDoc/, 
`const payload: any = {
        ['branchStock.' + locId]: increment(-transferQuantity),
        ['branchStock.' + targetLocation]: increment(transferQuantity)
      };
      
      const newStoreQty = storeQty - transferQuantity;
      await updateDoc`);

code = code.replace(/transferQuantity > storeQty/, "transferQuantity > storeQty");

code = code.replace(/d\.storeQuantity !== undefined \? d\.storeQuantity : \(d\.quantity \|\| 0\)/g, "d.branchStock?.[locId] || 0");
code = code.replace(/drug\.storeQuantity !== undefined \? drug\.storeQuantity : \(drug\.quantity \|\| 0\)/g, "drug.branchStock?.[locId] || 0");

code = code.replace(/Transfer to Dispensary/g, "Transfer to Branch");

// Add target branch selector
code = code.replace(/<form onSubmit=\{handleTransfer\} className="space-y-3">/,
`<form onSubmit={handleTransfer} className="space-y-3">
                  <select
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 bg-white"
                  >
                    <option value="branch_a">Branch A</option>
                    <option value="branch_b">Branch B</option>
                    <option value="central">Central Warehouse</option>
                  </select>`);

// Fix rendering of history
code = code.replace(/<tr>[\s\S]*?<th className="text-left font-bold py-2">Staff<\/th>[\s\S]*?<\/tr>/, 
`<tr><th className="text-left font-bold py-2">Date</th><th className="text-left font-bold py-2">Item</th><th className="text-right font-bold py-2">Qty</th><th className="text-left font-bold py-2">From -> To</th><th className="text-left font-bold py-2">By</th></tr>`);

code = code.replace(/<td className="py-2 text-slate-700">\{t\.storeUserName\}<\/td>/,
`<td className="py-2 text-slate-700">{t.fromLocationId} -> {t.toLocationId}</td>
<td className="py-2 text-slate-700">{t.requestedByName}</td>`);

fs.writeFileSync('src/components/StoreView.tsx', code);
