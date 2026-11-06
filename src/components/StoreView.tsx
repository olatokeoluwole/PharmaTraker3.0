import React from "react";
import { useState, useEffect, useMemo } from 'react';
import { db } from '../db';
import { collection, onSnapshot, doc, updateDoc, addDoc, increment } from '../db';
import { UserProfile, Drug, InterBranchTransfer } from '../types';
import { Package, Send, AlertTriangle } from 'lucide-react';

export default function StoreView({ profile, readOnly = false }: { profile: UserProfile, readOnly?: boolean }) {
  // Store inventory always defaults to Central Warehouse ('central')
  const [sourceLocation, setSourceLocation] = useState('central');
  const locId = sourceLocation || 'central';
  const [targetLocation, setTargetLocation] = useState('');

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [transfers, setTransfers] = useState<InterBranchTransfer[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  const [isTransferring, setIsTransferring] = useState(false);

  const resolvedSourceName = sourceLocation === 'central' 
    ? 'Central Warehouse (Main Store)' 
    : (branches.find(b => b.id === sourceLocation)?.name || 'Branch Store');

  const resolvedTargetName = targetLocation === 'central' 
    ? 'Central Warehouse' 
    : (branches.find(b => b.id === targetLocation)?.name || 'Branch');

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

  const getStockAtLoc = (d?: Drug, loc: string = locId): number => {
    if (!d) return 0;
    if (loc === 'central') {
      if (d.branchStock?.central !== undefined && d.branchStock.central !== null) {
        return Number(d.branchStock.central) || 0;
      }
      if (d.centralStock !== undefined && d.centralStock !== null) {
        return Number(d.centralStock) || 0;
      }
    }
    return Number(d.branchStock?.[loc] || 0);
  };

  const getTotalChainStock = (d?: Drug): number => {
    if (!d) return 0;
    const central = getStockAtLoc(d, 'central');
    const branchSum = Object.entries(d.branchStock || {})
      .filter(([k]) => k !== 'central')
      .reduce((sum, [_, v]) => sum + (Number(v) || 0), 0);
    return central + branchSum;
  };

  const lowStockDrugs = useMemo(() => {
    return drugs.filter(d => getTotalChainStock(d) <= 20);
  }, [drugs]);

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetLocation) {
      alert('Please select a destination target location.');
      return;
    }
    if (targetLocation === sourceLocation) {
      alert('Destination cannot be the same as the source location.');
      return;
    }
    if (!selectedDrug || !transferQuantity || Number(transferQuantity) <= 0 || isTransferring) {
      alert('Please select a drug and a valid quantity to transfer.');
      return;
    }

    try {
      setIsTransferring(true);
      const drug = drugs.find(d => d.id === selectedDrug);
      if (!drug) return;

      const qty = Number(transferQuantity);
      const availableStoreQty = getStockAtLoc(drug, locId);

      if (qty > availableStoreQty) {
        alert(`Insufficient stock in ${resolvedSourceName} to transfer. Available: ${availableStoreQty} ${drug.unit || 'units'}`);
        return;
      }

      await addDoc(collection(db, 'inter_branch_transfers'), {
        requestedBy: profile?.id || 'storekeeper',
        requestedByName: profile?.name || profile?.email || 'Store Keeper',
        drugId: drug.id,
        drugName: drug.name,
        fromLocationId: locId,
        toLocationId: targetLocation,
        status: 'approved',
        quantityTransferred: qty,
        createdAt: Date.now()
      });

      const drugRef = doc(db, 'drugs', drug.id);
      const payload: any = {
        ['branchStock.' + locId]: increment(-qty),
        ['branchStock.' + targetLocation]: increment(qty)
      };
      
      await updateDoc(drugRef, payload);

      setSelectedDrug('');
      setTransferQuantity('');
      alert(`Successfully transferred ${qty} ${drug.unit || 'units'} of ${drug.name} from ${resolvedSourceName} to ${resolvedTargetName}!`);
    } catch (err: any) {
      console.error(err);
      alert('Error transferring stock: ' + (err?.message || 'Check connection / permissions'));
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header with Location Switcher */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Store & Distribution Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Managing Inventory For: <strong className="text-indigo-700">{resolvedSourceName}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg p-1.5 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 pl-1.5">Active Location:</span>
            <select
              className="p-1 rounded text-xs bg-transparent focus:outline-none focus:text-indigo-600 font-bold text-slate-700"
              value={sourceLocation}
              onChange={(e) => {
                setSourceLocation(e.target.value);
                setSelectedDrug('');
              }}
            >
              <option value="central">Central Warehouse (Main Store)</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} (Branch)</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Global Low-Stock Alerts across entire chain */}
      {lowStockDrugs.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded shadow-xs">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="ml-3">
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Global Low-Stock Alert (Chain-wide &le; 20 units)
              </h3>
              <div className="mt-1 text-xs text-amber-800">
                <p>The following items are running low across the entire pharmacy network and require vendor restocking:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lowStockDrugs.map(d => (
                    <span key={d.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100/80 text-amber-900 border border-amber-200">
                      {d.name}: {getTotalChainStock(d)} remaining globally
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transfer form */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <section className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Send className="w-4 h-4 mr-2 text-indigo-600" />
                Dispatch / Transfer Stock
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100">
                Inter-Branch
              </span>
            </div>
            <div className="p-4 flex-1">
              <form onSubmit={handleTransfer} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">From (Source)</label>
                  <select
                    value={sourceLocation}
                    onChange={(e) => {
                      setSourceLocation(e.target.value);
                      setSelectedDrug('');
                    }}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500 bg-slate-50 font-semibold text-slate-700"
                  >
                    <option value="central">Central Warehouse (Main Store)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} (Branch)</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">To (Destination Branch)</label>
                  <select
                    required
                    value={targetLocation}
                    onChange={(e) => setTargetLocation(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500 bg-white font-semibold text-slate-800"
                  >
                    <option value="">-- Select Target Location --</option>
                    {sourceLocation !== 'central' && (
                      <option value="central">Central Warehouse (Return)</option>
                    )}
                    {branches.filter(b => b.id !== sourceLocation).map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Select Medication / Item</label>
                  <select
                    required
                    value={selectedDrug}
                    onChange={e => setSelectedDrug(e.target.value)}
                    disabled={readOnly}
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    <option value="">-- Select Item --</option>
                    {drugs.map(d => {
                      const avail = getStockAtLoc(d, locId);
                      return (
                        <option key={d.id} value={d.id} disabled={avail <= 0}>
                          {d.name} (Available in {sourceLocation === 'central' ? 'Central' : 'Branch'}: {avail})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase">Transfer Quantity</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Units to transfer"
                      value={transferQuantity}
                      onChange={e => setTransferQuantity(e.target.value === '' ? '' : parseInt(e.target.value))}
                      disabled={readOnly}
                      className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-bold"
                    />
                    <button
                      type="submit"
                      disabled={readOnly || isTransferring || !selectedDrug || !transferQuantity}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow-xs transition-colors flex items-center justify-center whitespace-nowrap disabled:opacity-50 cursor-pointer"
                    >
                      {isTransferring ? 'Transferring...' : 'Transfer'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </section>
        </div>

        {/* Inventory List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                  <Package className="w-4 h-4 mr-2 text-indigo-600" />
                  Store Inventory
                </h2>
                <span className="text-[11px] text-slate-500">
                  Stock currently held in: <strong className="text-slate-700">{resolvedSourceName}</strong>
                </span>
              </div>
              <span className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-full text-[10px] font-bold">
                {drugs.length} Items
              </span>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200 text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">
                      {sourceLocation === 'central' ? 'Central Store Qty' : 'Location Qty'}
                    </th>
                    <th className="px-4 py-3 text-right">Total Chain Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {drugs.map(drug => {
                    const qty = getStockAtLoc(drug, locId);
                    const totalChain = getTotalChainStock(drug);

                    return (
                      <tr key={drug.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {drug.name} <span className="text-slate-400 font-normal ml-1">({drug.unit || 'units'})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 capitalize">
                          {drug.category || 'medication'}
                        </td>
                        <td className="px-4 py-3 text-right font-black tabular-nums">
                          {(() => {
                            if (qty <= 0) return <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">0 (Depleted)</span>;
                            if (qty <= 15) return <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">{qty} (Low)</span>;
                            return <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold text-xs">{qty} in store</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-600 tabular-nums">
                          {totalChain} {drug.unit || 'units'}
                        </td>
                      </tr>
                    );
                  })}
                  {drugs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-4 text-center text-slate-500">No items available.</td>
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
