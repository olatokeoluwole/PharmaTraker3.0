import React from "react";
import { useState, useEffect } from 'react';
import { db } from '../db';
import { collection, onSnapshot, addDoc, query, orderBy, doc, updateDoc } from '../db';
import { UserProfile, Drug, Prescription } from '../types';
import { Activity, Search, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DoctorView({ profile, readOnly = false }: { profile: UserProfile, readOnly?: boolean }) {
  const locId = profile.locationId || 'unknown_branch';

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  
  const getBranchStock = (d?: Drug) => {
    if (!d) return 0;
    if (selectedBranchId) {
      return Number(d.branchStock?.[selectedBranchId] || 0);
    }
    return Object.entries(d.branchStock || {})
      .filter(([key]) => key !== 'central')
      .reduce((a: number, [_, b]: any) => a + (Number(b) || 0), 0) as number;
  };
  
  const [selectedDrug, setSelectedDrug] = useState('');
  const [patientName, setPatientName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  
  useEffect(() => {
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    }, (err) => console.warn("DoctorView drugs sync notice:", err));
    
    const q = query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'));
    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    const unsubPrescriptions = onSnapshot(q, (snap) => {
      setPrescriptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription)));
    }, (err) => console.warn("DoctorView prescriptions sync notice:", err));
    
    return () => {
      unsubDrugs();
      unsubBranches();
      unsubPrescriptions();
    };
  }, []);

  const handlePrescribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrug || !patientName || quantity <= 0 || isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      const drug = drugs.find(d => d.id === selectedDrug);
      if (!drug) return;

      const unitPrice = drug.sellingPrice || 0;
      const totalPrice = unitPrice * quantity;

      const prescriptionPayload: any = {
        doctorId: profile.id,
        doctorName: profile.name,
        patientName,
        drugId: drug.id,
        drugName: drug.name,
        quantity,
        status: 'pending',
        targetBranchId: selectedBranchId || null,
        createdAt: Date.now()
      };
      if (unitPrice > 0) {
        prescriptionPayload.unitPrice = unitPrice;
        prescriptionPayload.totalPrice = totalPrice;
      }

      await addDoc(collection(db, 'prescriptions'), prescriptionPayload);
      
      setSelectedDrug('');
      setPatientName('');
      setQuantity(0);
      alert('Prescription authorized and sent to branch.');
    } catch (err) {
      console.error(err);
      alert('Error creating prescription');
    } finally {
      setIsSubmitting(false);
    }
  };

  
  const filteredDrugs = drugs.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
  const medicationOptions = drugs.filter(d => (d.category || 'medication') !== 'consumable');
    const myPrescriptions = prescriptions.filter(p => p.doctorId === profile.id);

  return (
    <div className="flex flex-col gap-4">
      {/* Drug Availability */}
      <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
            <Activity className="w-4 h-4 mr-2" /> 1. Pharmacy Stock & Price Catalog
          </h2>
          <div className="relative w-full sm:w-auto mt-2 sm:mt-0 flex gap-2">
            <select
              value={selectedBranchId}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                setSelectedDrug(''); // Reset selected drug when branch changes
              }}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-blue-500 font-bold text-slate-600"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="relative w-full sm:w-56">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search Drug Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"
            />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="h-48 overflow-auto border border-slate-200 rounded p-2 bg-white">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-400 font-bold uppercase border-b text-[10px]">
                <tr>
                  <th className="pb-2">Medication / Item</th>
                  <th className="pb-2 text-right">Selling Price</th>
                  <th className="pb-2 text-right">Branch Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrugs.map(drug => (
                  <tr key={drug.id} className="hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-800">
                      {drug.name} <span className="text-slate-400 font-normal">({drug.unit || 'units'})</span>
                    </td>
                    <td className="py-2 text-right font-semibold text-slate-700">
                      {drug.sellingPrice ? `₦${drug.sellingPrice.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2 text-right font-bold">
                      {(() => {
                        const totalStock = getBranchStock(drug);
                        return (
                          <span className={totalStock > 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {totalStock > 0 ? `${totalStock} in stock` : 'Out of Stock'}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
                {filteredDrugs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-slate-500 text-center">No drugs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Create Prescription Form */}
        <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-700 uppercase text-xs">2. Clinical Unit (Doctor)</h2>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">Prescribing Desk</span>
          </div>
          <div className="p-4 flex-1">
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-3">
              <h3 className="text-xs font-bold text-indigo-800 mb-2">New Digital Prescription</h3>
              <form onSubmit={handlePrescribe} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Patient Name / ID"
                    value={patientName}
                    onChange={e => setPatientName(e.target.value)}
                    className="p-2 border border-indigo-200 rounded text-xs focus:outline-none focus:border-indigo-400 bg-white"
                  />
                  <select
                    required
                    disabled={!selectedBranchId}
                    value={selectedDrug}
                    onChange={e => setSelectedDrug(e.target.value)}
                    className="p-2 border border-indigo-200 rounded text-xs bg-white focus:outline-none focus:border-indigo-400"
                  >
                    <option value="">{selectedBranchId ? "-- Select Medication --" : "-- Select a Branch First --"}</option>
                    {medicationOptions.map(d => (
                      <option key={d.id} value={d.id} disabled={getBranchStock(d) <= 0}>
                        {d.name} ({getBranchStock(d)} in stock {d.sellingPrice ? `- ₦${d.sellingPrice}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 items-start">
                  <div className="flex-1">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Quantity"
                      value={quantity || ''}
                      onChange={e => setQuantity(parseInt(e.target.value))}
                      className="w-full p-2 border border-indigo-200 rounded text-xs focus:outline-none focus:border-indigo-400 bg-white"
                    />
                    {selectedDrug && quantity > 0 && getBranchStock(drugs.find(d => d.id === selectedDrug)) < quantity && (
                      <p className="mt-1 text-[10px] text-red-600 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" /> Requested exceeds stock
                      </p>
                    )}
                  </div>
                </div>

                {selectedDrug && quantity > 0 && drugs.find(d => d.id === selectedDrug)?.sellingPrice ? (
                  <div className="text-[11px] font-semibold text-indigo-900 bg-indigo-100/60 p-2 rounded">
                    Estimated Patient Cost: ₦{((drugs.find(d => d.id === selectedDrug)?.sellingPrice || 0) * quantity).toLocaleString()}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={readOnly || isSubmitting || (selectedDrug ? (quantity > getBranchStock(drugs.find(d => d.id === selectedDrug))) : false)}
                  className="w-full py-2 bg-indigo-600 text-white rounded text-xs font-bold shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? 'Sending...' : 'Authorize & Send to Branch'}
                </button>
              </form>
            </div>

            </div>
        </section>

        {/* Prescription History */}
        <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold text-slate-700 uppercase text-xs">Recent Prescriptions</h2>
            <span className="text-[10px] font-bold text-slate-500">Live Status</span>
          </div>
          <div className="p-4 flex flex-col flex-1 gap-2 max-h-[500px] overflow-y-auto">
            {myPrescriptions.map(p => (
              <div key={p.id} className="p-3 border border-slate-200 rounded-lg bg-white shadow-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-800 text-xs">{p.drugName} ({p.quantity})</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    p.status === 'dispensed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {p.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">Patient: {p.patientName}</div>
                <div className="text-[10px] text-slate-400 mt-1">{format(p.createdAt, 'MMM d, yyyy h:mm a')}</div>
              </div>
            ))}
            {myPrescriptions.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-6">No prescriptions issued yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
