import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, getDoc } from '../firebase';
import { UserProfile, Prescription, Drug, DispenseRecord } from '../types';
import { Check, Clock, PackageOpen, Plus, DollarSign, CreditCard, ShoppingCart, TrendingUp, AlertCircle, Lock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

export default function BranchView({ profile, readOnly = false }: { profile: UserProfile, readOnly?: boolean }) {
  const [selectedBranchId, setSelectedBranchId] = useState(profile.locationId || '');
  const locId = readOnly ? selectedBranchId : (profile.locationId || '');
  
  const getBranchStock = (d?: Drug) => {
    if (!d) return 0;
    if (!locId) {
      return Object.entries(d.branchStock || {})
        .filter(([key]) => key !== 'central')
        .reduce((a: number, [_, b]: any) => a + (Number(b) || 0), 0) as number;
    }
    return Number(d.branchStock?.[locId] || 0);
  };

  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [dispenseRecords, setDispenseRecords] = useState<DispenseRecord[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const resolvedBranchName = branches.find(b => b.id === locId)?.name || 'Unknown Branch';
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Modal State for dispensing a prescription with locked official rate & payment
  const [selectedPrescriptionForDispense, setSelectedPrescriptionForDispense] = useState<Prescription | null>(null);
  const [dispensePaymentMethod, setDispensePaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'insurance' | 'other'>('cash');

  // Direct OTC Sale Form State with locked official rate
  const [showDirectSaleModal, setShowDirectSaleModal] = useState(false);
  const [directSaleDrugId, setDirectSaleDrugId] = useState('');
  const [directSaleQuantity, setDirectSaleQuantity] = useState<number | ''>('');
  const [directSalePatientName, setDirectSalePatientName] = useState('');
  const [directSalePaymentMethod, setDirectSalePaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'insurance' | 'other'>('cash');
  const [isSubmittingDirectSale, setIsSubmittingDirectSale] = useState(false);
  const [directSaleError, setDirectSaleError] = useState('');
  const [directSaleSuccess, setDirectSaleSuccess] = useState('');

  useEffect(() => {
    const qPrescriptions = query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'));
    const unsubPrescriptions = onSnapshot(qPrescriptions, (snap) => {
      setPrescriptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription)));
    }, (err) => console.warn("BranchView prescriptions sync notice:", err));

    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    }, (err) => console.warn("BranchView drugs sync notice:", err));

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snap) => {
      setBranches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const qDispenses = query(collection(db, 'dispense_records'), orderBy('createdAt', 'desc'));
    const unsubDispenses = onSnapshot(qDispenses, (snap) => {
      setDispenseRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DispenseRecord)));
    }, (err) => console.warn("BranchView dispenses sync notice:", err));

    return () => {
      unsubPrescriptions();
      unsubDrugs();
      unsubDispenses();
      unsubBranches();
    };
  }, []);

  // When selecting a prescription to dispense
  const openDispenseModal = (p: Prescription) => {
    setSelectedPrescriptionForDispense(p);
    setDispensePaymentMethod('cash');
  };

  const handleConfirmDispensePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrescriptionForDispense) return;

    const prescription = selectedPrescriptionForDispense;
    setProcessingId(prescription.id);

    try {
      const drug = drugs.find(d => d.id === prescription.drugId);
      // Strictly use official administered selling price (or doctor-locked rate), completely unalterable by branch
      const officialUnitPrice = (drug?.sellingPrice !== undefined && drug.sellingPrice !== null) 
        ? drug.sellingPrice 
        : (prescription.unitPrice || 0);
      const totalAmount = officialUnitPrice * prescription.quantity;

      // Create dispense record with official financial sales data
      await addDoc(collection(db, 'dispense_records'), {
        prescriptionId: prescription.id,
        branchId: locId,
        branchName: resolvedBranchName,
        drugId: prescription.drugId,
        drugName: prescription.drugName,
        quantityDispensed: prescription.quantity,
        unitPrice: officialUnitPrice,
        totalAmount: totalAmount,
        patientName: prescription.patientName,
        paymentMethod: dispensePaymentMethod,
        createdAt: Date.now()
      });

      // Update prescription status & pricing
      await updateDoc(doc(db, 'prescriptions', prescription.id), {
        status: 'dispensed',
        unitPrice: officialUnitPrice,
        totalPrice: totalAmount
      });

      // Update inventory quantity in branch
      const drugRef = doc(db, 'drugs', prescription.drugId);
      const drugSnap = await getDoc(drugRef);
      
      if (drugSnap.exists()) {
        const drugData = drugSnap.data();
        const currentQty = drugData.branchStock?.[locId] || 0;
        const newQty = Math.max(0, currentQty - prescription.quantity);
        
        await updateDoc(drugRef, {
          ['branchStock.' + locId]: newQty
        });

        // Trigger notification if low stock
        if (newQty <= 3 && newQty < currentQty) {
          fetch('/api/notify-low-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drugName: prescription.drugName,
              quantity: newQty
            })
          }).catch(err => console.error("Failed to notify low stock", err));
        }
      }

      setSelectedPrescriptionForDispense(null);
    } catch (err) {
      console.error(err);
      alert('Error dispensing medication. Please check permissions or connection.');
    } finally {
      setProcessingId(null);
    }
  };

  // Direct Over-the-counter sale handler
  const handleDirectSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setDirectSaleError('');
    setDirectSaleSuccess('');
    if (!directSaleDrugId || !directSaleQuantity || Number(directSaleQuantity) <= 0 || isSubmittingDirectSale) {
      setDirectSaleError('Please select a drug and valid quantity.');
      return;
    }

    const drug = drugs.find(d => d.id === directSaleDrugId);
    if (!drug) return;

    const availableQty = getBranchStock(drug);
    const qtyToSell = Number(directSaleQuantity);

    if (qtyToSell > availableQty) {
      setDirectSaleError(`Insufficient stock in branch. Available: ${availableQty} ${drug.unit || 'units'}`);
      return;
    }

    try {
      setIsSubmittingDirectSale(true);
      // Strictly use official administered selling price, completely unalterable by branch
      const officialUnitPrice = (drug.sellingPrice !== undefined && drug.sellingPrice !== null) ? drug.sellingPrice : 0;
      const totalAmount = officialUnitPrice * qtyToSell;

      // Record direct sales revenue in dispense_records
      await addDoc(collection(db, 'dispense_records'), {
        branchId: locId,
        branchName: resolvedBranchName,
        drugId: drug.id,
        drugName: drug.name,
        quantityDispensed: qtyToSell,
        unitPrice: officialUnitPrice,
        totalAmount: totalAmount,
        patientName: directSalePatientName.trim() || 'Walk-in Customer',
        paymentMethod: directSalePaymentMethod,
        createdAt: Date.now()
      });

      // Deduct from branch stock (does NOT alter sellingPrice or costPrice)
      const newQty = availableQty - qtyToSell;
      await updateDoc(doc(db, 'drugs', drug.id), {
        ['branchStock.' + locId]: newQty
      });

      // Reset form
      setDirectSaleDrugId('');
      setDirectSaleQuantity('');
      setDirectSalePatientName('');
      setShowDirectSaleModal(false);
      setDirectSaleSuccess('Sale completed and income recorded successfully.');
      setTimeout(() => setDirectSaleSuccess(''), 3000);
    } catch (err) {
      console.error('Error logging direct sale:', err);
      setDirectSaleError('Failed to complete sale. Please try again.');
    } finally {
      setIsSubmittingDirectSale(false);
    }
  };

  const filteredDispenses = !locId ? dispenseRecords : dispenseRecords.filter(d => d.branchId === locId);
  const pending = prescriptions.filter(p => p.status === 'pending' && (!p.targetBranchId || !locId || p.targetBranchId === locId));
  const dispensed = prescriptions.filter(p => p.status === 'dispensed' && (!p.targetBranchId || !locId || p.targetBranchId === locId));

  // Calculate today's sales income recorded by branch
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayDispenses = filteredDispenses.filter(d => d.createdAt >= todayStart.getTime());
  const todayIncome = todayDispenses.reduce((sum, d) => {
    if (d.totalAmount !== undefined) return sum + d.totalAmount;
    if (d.unitPrice !== undefined) return sum + (d.quantityDispensed * d.unitPrice);
    const drug = drugs.find(item => item.id === d.drugId);
    return sum + (d.quantityDispensed * (drug?.sellingPrice || 0));
  }, 0);

  const selectedPrescriptionDrug = selectedPrescriptionForDispense 
    ? drugs.find(d => d.id === selectedPrescriptionForDispense.drugId)
    : null;
  const currentPrescriptionOfficialRate = selectedPrescriptionDrug?.sellingPrice !== undefined && selectedPrescriptionDrug.sellingPrice !== null
    ? selectedPrescriptionDrug.sellingPrice
    : (selectedPrescriptionForDispense?.unitPrice || 0);

  const selectedDirectSaleDrug = drugs.find(d => d.id === directSaleDrugId);
  const directSaleOfficialRate = selectedDirectSaleDrug?.sellingPrice !== undefined && selectedDirectSaleDrug.sellingPrice !== null
    ? selectedDirectSaleDrug.sellingPrice
    : 0;

  return (
        <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Branch Dashboard</h1>
        {!readOnly && (
          <button
            onClick={() => setShowDirectSaleModal(true)}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            Sale
          </button>
        )}
      </div>
      {readOnly && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <label className="text-sm font-bold text-slate-700">View Branch:</label>
          <select 
            className="p-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600 font-medium"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      {/* Local Stock Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Low-Stock Alerts */}
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded shadow-sm max-h-48 overflow-y-auto">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm leading-5 font-medium text-amber-800">
                Local Low-Stock Alert
              </h3>
              <div className="mt-2 text-sm leading-5 text-amber-700">
                {drugs.filter(d => getBranchStock(d) <= 5).length > 0 ? (
                  <>
                    <p>The following items are running low in your branch:</p>
                    <ul className="list-disc pl-5 mt-1">
                      {drugs.filter(d => getBranchStock(d) <= 5).map(d => (
                        <li key={d.id}>{d.name} ({d.branchStock?.[locId] || 0} remaining)</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>All stock levels are healthy.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Available Stock */}
        <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded shadow-sm max-h-48 overflow-y-auto">
          <div className="flex">
            <div className="flex-shrink-0">
              <PackageOpen className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="ml-3 w-full">
              <h3 className="text-sm leading-5 font-medium text-emerald-800">
                Available Stock
              </h3>
              <div className="mt-2 text-sm leading-5 text-emerald-700">
                {drugs.filter(d => getBranchStock(d) > 0).length > 0 ? (
                  <ul className="list-disc pl-5 mt-1">
                    {drugs.filter(d => getBranchStock(d) > 0).map(d => (
                      <li key={d.id}>{d.name} ({d.branchStock?.[locId] || 0} available)</li>
                    ))}
                  </ul>
                ) : (
                  <p>No stock currently available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Branch Sales & Status Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Prescriptions</div>
            <div className="text-2xl font-black text-amber-600">{pending.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fulfilled Orders</div>
            <div className="text-2xl font-black text-emerald-600">{dispensed.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Sales Income</div>
            <div className="text-2xl font-black text-indigo-700">₦{todayIncome.toLocaleString()}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pending Prescriptions */}
        <section className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-slate-800 uppercase text-xs">Prescription Dispensing Queue</h2>
              <span className="text-[11px] text-slate-500">Doctor prescriptions awaiting fulfillment</span>
            </div>

          </div>

          <div className="p-4 flex flex-col flex-1 gap-3">
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px]">
              {pending.map(p => {
                const drug = drugs.find(d => d.id === p.drugId);
                const currentDispStock = getBranchStock(drug);
                const isOutOfStock = currentDispStock < p.quantity;
                const estPrice = drug?.sellingPrice || 0;
                const estTotal = estPrice * p.quantity;

                return (
                  <div key={p.id} className="p-3.5 border border-slate-200 rounded-xl bg-white relative shadow-xs hover:border-slate-300 transition-colors">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-bold text-slate-400">
                        RX #{p.id.slice(0, 6).toUpperCase()} &bull; Dr. {p.doctorName}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{p.drugName}</h4>
                        <div className="text-xs text-slate-600 font-medium mt-0.5">
                          Patient: <span className="font-bold text-slate-800">{p.patientName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-indigo-700">
                          Qty: {p.quantity} {drug?.unit || 'units'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-semibold flex items-center justify-end gap-1">
                          <Lock className="w-3 h-3 text-slate-400" />
                          {estPrice > 0 ? `Official: ₦${estTotal.toLocaleString()} (₦${estPrice}/unit)` : 'Price not set'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
                      <span className={`font-semibold flex items-center gap-1 ${
                        isOutOfStock ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {isOutOfStock && <AlertCircle className="w-3.5 h-3.5" />}
                        Branch Stock: {currentDispStock} {drug?.unit || 'units'}
                      </span>
                      <span className="text-slate-400">{format(p.createdAt, 'MMM d, h:mm a')}</span>
                    </div>

                    {!readOnly && (
                      <button
                        onClick={() => openDispenseModal(p)}
                        disabled={processingId === p.id}
                        className="mt-2.5 w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <PackageOpen className="w-3.5 h-3.5" />
                        {processingId === p.id ? 'Processing...' : 'Dispense & Record Sale'}
                      </button>
                    )}
                  </div>
                );
              })}

              {pending.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No pending prescriptions in the queue.
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Recently Fulfilled Dispenses & Sales */}
        <section className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-slate-800 uppercase text-xs">Recent Dispense & Sales History</h2>
              <span className="text-[11px] text-slate-500">Fulfilled orders and direct walk-in sales</span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold flex items-center gap-1">
              <Check className="w-3 h-3" />
              {filteredDispenses.length} Total Sales
            </span>
          </div>

          <div className="p-4 flex flex-col flex-1 gap-3">
            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[500px]">
              {filteredDispenses.slice(0, 15).map(record => {
                const drug = drugs.find(d => d.id === record.drugId);
                const unitPrice = record.unitPrice || drug?.sellingPrice || 0;
                const total = record.totalAmount || (unitPrice * record.quantityDispensed);

                return (
                  <div key={record.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50/70 text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">
                        {record.drugName} <span className="font-normal text-slate-500">({record.quantityDispensed} {drug?.unit || 'units'})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Patient: {record.patientName || 'Walk-in'}</span>
                        <span>&bull;</span>
                        <span className="capitalize">{record.paymentMethod || 'Cash'}</span>
                        <span>&bull;</span>
                        <span>{format(record.createdAt, 'MMM d, h:mm a')}</span>
                      </div>
                    </div>

                    <div className="text-right whitespace-nowrap pl-3">
                      <div className="font-extrabold text-emerald-700 text-sm">
                        +₦{total.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {unitPrice > 0 ? `₦${unitPrice}/unit (Fixed)` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredDispenses.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No sales or dispense records logged yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* MODAL: Dispense Prescription with Locked Official Price & Payment */}
      {selectedPrescriptionForDispense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <PackageOpen className="w-4 h-4 text-emerald-400" />
                  Fulfill Prescription & Collect Payment
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Collect billed amount at official administered selling rate</p>
              </div>
              <button
                onClick={() => setSelectedPrescriptionForDispense(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleConfirmDispensePrescription} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-900 text-sm">{selectedPrescriptionForDispense.drugName}</div>
                <div className="text-slate-600 mt-0.5">
                  Patient: <span className="font-bold">{selectedPrescriptionForDispense.patientName}</span>
                </div>
                <div className="text-slate-600 mt-0.5">
                  Prescribed Quantity: <span className="font-bold">{selectedPrescriptionForDispense.quantity}</span>
                </div>
              </div>

              {/* Locked Official Selling Price Section */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-500 uppercase text-[10px] flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Official Unit Rate
                    </span>
                    <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                      Locked
                    </span>
                  </div>
                  <div className="text-base font-black text-slate-900">
                    {currentPrescriptionOfficialRate > 0 ? (
                      `₦${currentPrescriptionOfficialRate.toLocaleString()}`
                    ) : (
                      <span className="text-xs text-amber-600 font-semibold">₦0.00 (Rate Unset)</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5">Admin-configured rate</span>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex flex-col justify-between">
                  <span className="font-bold text-emerald-800 uppercase text-[10px] mb-1">
                    Total Bill Due (₦)
                  </span>
                  <div className="text-lg font-black text-emerald-800">
                    ₦{(currentPrescriptionOfficialRate * selectedPrescriptionForDispense.quantity).toLocaleString()}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                    {selectedPrescriptionForDispense.quantity} &times; ₦{currentPrescriptionOfficialRate.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-lg flex items-center gap-2 text-[11px] text-indigo-800">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Price is locked by Management. Branch cannot alter selling rates.</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Payment Method</label>
                <select
                  value={dispensePaymentMethod}
                  onChange={e => setDispensePaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                >
                  <option value="cash">Cash Payment</option>
                  <option value="card">POS / Debit Card</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="insurance">Health Insurance / HMO</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPrescriptionForDispense(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId !== null}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {processingId ? 'Processing...' : 'Confirm Dispense & Collect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Direct / Over-the-counter Walk-in Sale with Locked Official Price */}
      {showDirectSaleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 bg-indigo-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-indigo-300" />
                  Sale
                </h3>
                <p className="text-[11px] text-indigo-200 mt-0.5">Record a new sale</p>
              </div>
              <button
                onClick={() => {
                  setShowDirectSaleModal(false);
                  setDirectSaleError('');
                  setDirectSaleSuccess('');
                }}
                className="text-indigo-200 hover:text-white text-lg font-bold px-2 py-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleDirectSale} className="p-5 space-y-4 text-xs">
              {directSaleError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {directSaleError}
                </div>
              )}
              {directSaleSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 shrink-0" />
                  {directSaleSuccess}
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                  Select Item / Drug <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={directSaleDrugId}
                  onChange={e => setDirectSaleDrugId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="">-- Choose Drug / Medication --</option>
                  {drugs.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.unit || 'unit'}) &bull; Stock: {d.branchStock?.[locId] || 0} &bull; Price: {d.sellingPrice ? `₦${d.sellingPrice.toLocaleString()}` : 'Price not set'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Patient / Customer Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe / Walk-in"
                  value={directSalePatientName}
                  onChange={e => setDirectSalePatientName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                    Quantity to Sell <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Qty"
                    value={directSaleQuantity}
                    onChange={e => setDirectSaleQuantity(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-bold bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>

                {/* Locked Official Unit Rate Display */}
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-400" />
                      Unit Price (₦)
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Locked</span>
                  </label>
                  <div className="p-2.5 bg-slate-100 rounded-lg border border-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-between">
                    <span>
                      {directSaleOfficialRate > 0 ? `₦${directSaleOfficialRate.toLocaleString()}` : '₦0.00'}
                    </span>
                    <Lock className="w-3 h-3 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Total Calculated Bill */}
              <div>
                <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Total Bill</label>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 font-black text-base flex justify-between items-center">
                  <span>Total Amount:</span>
                  <span>₦{((Number(directSaleQuantity) || 0) * directSaleOfficialRate).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-2.5 bg-indigo-50/80 border border-indigo-100 rounded-lg flex items-center gap-2 text-[11px] text-indigo-900">
                <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Unit selling price is centrally determined and cannot be modified at branch.</span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Payment Method</label>
                <select
                  value={directSalePaymentMethod}
                  onChange={e => setDirectSalePaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                >
                  <option value="cash">Cash</option>
                  <option value="card">POS / Debit Card</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="insurance">Insurance / HMO</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                  setShowDirectSaleModal(false);
                  setDirectSaleError('');
                  setDirectSaleSuccess('');
                }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDirectSale}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSubmittingDirectSale ? 'Processing...' : 'Purchase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
