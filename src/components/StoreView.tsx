import React from "react";
import { useState, useEffect } from 'react';
import { db } from '../db';
import { collection, onSnapshot, doc, updateDoc, addDoc, increment } from '../db';
import { UserProfile, Drug, InterBranchTransfer } from '../types';
import { Package, Send } from 'lucide-react';
import { format } from 'date-fns';

export default function StoreView({ profile, readOnly = false }: { profile: UserProfile, readOnly?: boolean }) {
  const locId = profile.locationId || 'central';
  const [targetLocation, setTargetLocation] = useState('');

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transfers, setTransfers] = useState<InterBranchTransfer[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [transferQuantity, setTransferQuantity] = useState(0);

  useEffect(() => {
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    }, (err) => console.warn("StoreView drugs sync notice:", err));
    
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubTransfers = onSnapshot(collection(db, 'inter_branch_transfers'), (snap) => {
      setTransfers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InterBranchTransfer)));
    }, (err) => console.warn("StoreView transfers sync notice:", err));

    return () => {
      unsubDrugs();
      unsubTransfers();
      unsubBranches();
    };
  }, []);

  const handleTransfer = async (e: React.FormEvent) => {
    if (!targetLocation) return;
    e.preventDefault();
    if (!selectedDrug || transferQuantity <= 0) return;
    try {
      const drug = drugs.find(d => d.id === selectedDrug);
      if (!drug) return;

      const storeQty = drug.branchStock?.[locId] || 0;

      if (transferQuantity > storeQty) {
        alert('Insufficient stock in the store to transfer.');
        return;
      }

      await addDoc(collection(db, 'inter_branch_transfers'), {
        requestedBy: profile.id,
        requestedByName: profile.name,
        drugId: drug.id,
        drugName: drug.name,
        fromLocationId: locId,
        toLocationId: targetLocation,
        status: 'approved',
        
        quantityTransferred: transferQuantity,
        createdAt: Date.now()
      });

      const drugRef = doc(db, 'drugs', drug.id);
      
      const payload: any = {
        ['branchStock.' + locId]: increment(-transferQuantity),
        ['branchStock.' + targetLocation]: increment(transferQuantity)
      };
      
      const newStoreQty = storeQty - transferQuantity;
      await updateDoc(drugRef, payload);

      // Trigger email notification if stock is 3 or below and decreasing
      if (newStoreQty <= 3 && storeQty > 3) {
        fetch('/api/notify-low-stock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ drugName: drug.name, quantity: newStoreQty })
        }).catch(err => console.error("Failed to trigger low stock notification", err));
      }
      
      setSelectedDrug('');
      setTransferQuantity(0);
    } catch (err) {
      console.error(err);
      alert('Error transferring stock');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Global Low-Stock Alerts */}
      {drugs.filter(d => (Object.values(d.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) <= 20).length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 rounded shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                 <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm leading-5 font-medium text-red-800">
                Global Low-Stock Alert
              </h3>
              <div className="mt-2 text-sm leading-5 text-red-700">
                <p>The following items are running low across the ENTIRE chain and require central restocking:</p>
                <ul className="list-disc pl-5 mt-1">
                  {drugs.filter(d => (Object.values(d.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) <= 20).map(d => (
                    <li key={d.id}>{d.name} ({(Object.values(d.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0)} remaining globally)</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transfer form */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Send className="w-4 h-4 mr-2" />
                Transfer to Branch
              </h2>
            </div>
            <div className="p-4 flex-1">
              <form onSubmit={handleTransfer} className="space-y-3">
                  
                  <select
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 bg-white"
                  >
                    <option value="">Select Target Location</option>
                    <option value="central">Central Warehouse</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>

                <select
                  required
                  value={selectedDrug}
                  onChange={e => setSelectedDrug(e.target.value)}
                  disabled={readOnly}
                  className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400 disabled:opacity-50"
                >
                  <option value="">-- Select Item --</option>
                  {drugs.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} (Available: {d.branchStock?.[locId] || 0})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Qty"
                    value={transferQuantity || ''}
                    onChange={e => setTransferQuantity(parseInt(e.target.value))}
                    disabled={readOnly}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={readOnly}
                    className="w-full py-2 bg-indigo-600 text-white rounded text-xs font-bold shadow-sm hover:bg-indigo-700 transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50"
                  >
                    Transfer
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>

        {/* Dashboard */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="flex-1 flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Package className="w-4 h-4 mr-2" /> Store Inventory
              </h2>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Store Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {drugs.map(drug => (
                    <tr key={drug.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {drug.name} <span className="text-slate-400 font-normal ml-1">({drug.unit})</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 capitalize">
                        {drug.category || 'medication'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {drug.branchStock?.[locId] || 0}
                      </td>
                    </tr>
                  ))}
                  {drugs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-slate-500">No items available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
