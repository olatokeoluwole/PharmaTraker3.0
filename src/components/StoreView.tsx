import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, onSnapshot, doc, updateDoc, addDoc, increment, syncBus, broadcastChannel } from '../db';
import { UserProfile, Drug, InterBranchTransfer, PurchaseRecord } from '../types';
import { Package, Send, AlertTriangle, RefreshCw, Search, Truck, ArrowRight, ShieldCheck, Calendar, Layers } from 'lucide-react';

export default function StoreView({ profile, readOnly = false }: { profile: UserProfile, readOnly?: boolean }) {
  // Store inventory always defaults to Central Warehouse ('central')
  const [sourceLocation, setSourceLocation] = useState('central');
  const locId = sourceLocation || 'central';
  const [targetLocation, setTargetLocation] = useState('');

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [transfers, setTransfers] = useState<InterBranchTransfer[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedDrug, setSelectedDrug] = useState('');
  const [transferQuantity, setTransferQuantity] = useState<number | ''>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(new Date().toLocaleTimeString());

  const resolvedSourceName = sourceLocation === 'central' 
    ? 'Central Warehouse (Main Store)' 
    : (branches.find(b => b.id === sourceLocation)?.name || 'Branch Store');

  const resolvedTargetName = targetLocation === 'central' 
    ? 'Central Warehouse' 
    : (branches.find(b => b.id === targetLocation)?.name || 'Branch');

  useEffect(() => {
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
      setLastSyncedTime(new Date().toLocaleTimeString());
    }, (err) => console.warn("StoreView drugs sync notice:", err));
    
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubTransfers = onSnapshot(collection(db, 'inter_branch_transfers'), (snap) => {
      setTransfers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InterBranchTransfer)));
    }, (err) => console.warn("StoreView transfers sync notice:", err));

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snap) => {
      setPurchases(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRecord)));
    }, (err) => console.warn("StoreView purchases sync notice:", err));

    return () => {
      unsubDrugs();
      unsubTransfers();
      unsubBranches();
      unsubPurchases();
    };
  }, []);

  const triggerManualSync = () => {
    setIsRefreshing(true);
    try {
      if (syncBus) {
        syncBus.dispatchEvent(new CustomEvent('mutation', { detail: { table: 'drugs' } }));
      }
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type: 'MUTATION', table: 'drugs', timestamp: Date.now() });
      }
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setLastSyncedTime(new Date().toLocaleTimeString());
      }, 500);
    }
  };

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    drugs.forEach(d => {
      if (d.category) set.add(d.category);
    });
    return Array.from(set);
  }, [drugs]);

  const filteredDrugs = useMemo(() => {
    return drugs.filter(d => {
      const matchesSearch = !searchQuery.trim() || d.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || (d.category || '').toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [drugs, searchQuery, categoryFilter]);

  const recentPurchases = useMemo(() => {
    return [...purchases]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 5);
  }, [purchases]);

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
      {/* Header with Location Switcher & Live Sync Indicator */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Store & Distribution Hub
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Sync Active
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Managing Central Inventory & Branch Logistics &bull; Showing stock for: <strong className="text-indigo-700">{resolvedSourceName}</strong>
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Location Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg p-1.5 shadow-xs">
            <span className="text-[11px] font-bold text-slate-500 pl-1.5">View Stock At:</span>
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

          {/* Sync Button with last sync time */}
          <button
            onClick={triggerManualSync}
            disabled={isRefreshing}
            title={`Last synced: ${lastSyncedTime}`}
            className="flex items-center gap-1 px-2.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden md:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* Global Low-Stock Alerts across entire chain */}
      {lowStockDrugs.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-xs">
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Dispatch & Central Purchases Log */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Dispatch / Transfer Form */}
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

          {/* Recent Central Purchases / Inward Goods Received */}
          <section className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                <Truck className="w-4 h-4 mr-2 text-emerald-600" />
                Recent Central Purchases Inward
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100">
                Live Admin Sync
              </span>
            </div>
            <div className="p-3 divide-y divide-slate-100 max-h-64 overflow-y-auto text-xs">
              {recentPurchases.map(p => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{p.drugName}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.supplier ? `Supplier: ${p.supplier}` : 'Supplier restock'} &bull; {p.expiryDate ? `Exp: ${p.expiryDate}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold border border-emerald-200">
                      +{p.quantityPurchased ?? (p as any).quantity ?? 0} units
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Recent'}
                    </p>
                  </div>
                </div>
              ))}
              {recentPurchases.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No purchase records recorded yet.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Column: Inventory List & Search */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <section className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
              <div>
                <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                  <Package className="w-4 h-4 mr-2 text-indigo-600" />
                  Store Inventory
                </h2>
                <span className="text-[11px] text-slate-500">
                  Stock currently held in: <strong className="text-slate-700">{resolvedSourceName}</strong>
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search item..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-700 w-36 sm:w-48 font-medium"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:border-indigo-500 text-slate-700 capitalize font-medium"
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
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
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredDrugs.map(drug => {
                    const qty = getStockAtLoc(drug, locId);
                    const totalChain = getTotalChainStock(drug);

                    return (
                      <tr key={drug.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">
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
                        <td className="px-4 py-3 text-center">
                          {qty > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              <ShieldCheck className="w-3 h-3" /> In Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                              Depleted
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDrugs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        No items found matching your criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
              <span>Showing {filteredDrugs.length} of {drugs.length} total items</span>
              <span className="font-semibold text-slate-700">All data automatically synced with Admin & Branches</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
