import React from "react";
import { useState, useEffect, useMemo } from 'react';
import { db } from '../db';
import { collection, query, orderBy, onSnapshot, doc, setDoc, addDoc, updateDoc, deleteDoc, increment, getDoc } from '../db';
import { UserProfile, Drug, PurchaseRecord, DispenseRecord, AuditReport, DisposalRecord, OperatingExpense, Role } from '../types';
import { Package, BarChart3, Plus, AlertTriangle, CheckCircle2, UserX, Users, Trash2, Clock, Wallet, DollarSign, Edit2, Check, X, ShieldAlert, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { format } from 'date-fns';
import DoctorView from "./DoctorView";
import HMOView from "./HMOView";
import StoreView from './StoreView';
import BranchView from './BranchView';
import FinanceView from './FinanceView';
import AnalyticsView from './AnalyticsView';
import ImportDrugsModal from './ImportDrugsModal';

export default function AdminView({ profile }: { profile: UserProfile }) {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [dispenses, setDispenses] = useState<DispenseRecord[]>([]);
  const [audits, setAudits] = useState<AuditReport[]>([]);
  const [disposals, setDisposals] = useState<DisposalRecord[]>([]);
  const [expenses, setExpenses] = useState<OperatingExpense[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [staffRoles, setStaffRoles] = useState<any[]>([]);

  // Drug Registration State
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugUnit, setNewDrugUnit] = useState('');
  const [newDrugCategory, setNewDrugCategory] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'admin' | 'finance' | 'analytics' | 'store' | 'branch' | 'doctor' | 'hmo' | 'expiry' | 'branches' | 'branch_transactions'>('admin');

  
  const [dispenseRecords, setDispenseRecords] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    if (activeTab === 'branch_transactions') {
      const q = query(collection(db, 'dispense_records'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, snap => {
        setDispenseRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    }
  }, [activeTab]);

  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');
  const [newBranchEmail, setNewBranchEmail] = useState('');

  const handleAddBranch = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    try {
      await addDoc(collection(db, 'branches'), {
        name: newBranchName,
        address: newBranchAddress,
        email: newBranchEmail,
        createdAt: Date.now(),
        
      });
      setNewBranchName('');
      setNewBranchAddress('');
      setNewBranchEmail('');
    } catch (err) {
      alert('Error adding branch: ' + err.message);
    }
  };

  const handleDeleteBranch = async (id) => {
    if (!window.confirm('Delete this branch?')) return;
    try {
      await deleteDoc(doc(db, 'branches', id));
    } catch(err) {
      alert('Error deleting branch: ' + err.message);
    }
  };


  // Stock Intake (Purchase) State
  const [selectedDrug, setSelectedDrug] = useState('');
  const [purchaseQuantity, setPurchaseQuantity] = useState<number | ''>('');
  const [purchaseUnitCostPrice, setPurchaseUnitCostPrice] = useState<number | ''>('');
  const [purchaseSupplier, setPurchaseSupplier] = useState('');
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState('');
  const [purchaseExpiryDate, setPurchaseExpiryDate] = useState('');

  // Audit Form State
  const [auditDrug, setAuditDrug] = useState('');
  const [auditMissingQty, setAuditMissingQty] = useState(0);
  const [auditUserId, setAuditUserId] = useState('');
  const [auditNotes, setAuditNotes] = useState('');

  // Disposal Form State
  const [disposalDrug, setDisposalDrug] = useState('');
  const [disposalQuantity, setDisposalQuantity] = useState(0);
  const [disposalReason, setDisposalReason] = useState('expired');
  const [disposalNotes, setDisposalNotes] = useState('');

  // Inventory Table Search & Filter
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('all');

  // Editing Drug Price inline
  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [editCostPrice, setEditCostPrice] = useState<number | ''>('');
  const [editSellingPrice, setEditSellingPrice] = useState<number | ''>('');

  // Expiry Search & Filter
  const [expirySearchTerm, setExpirySearchTerm] = useState('');
  const [expiryStatusFilter, setExpiryStatusFilter] = useState('all');

  // Staff Registration & Role Management
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState<Role>('doctor');
  const [staffLocationId, setStaffLocationId] = useState('');
  const [isRegisteringStaff, setIsRegisteringStaff] = useState(false);
  const [roleOverrides, setRoleOverrides] = useState<Record<string, Role>>({});
  const [updatingUserIds, setUpdatingUserIds] = useState<Record<string, boolean>>({});
  const [roleSuccessMessage, setRoleSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snap) => {
      setDrugs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    }, (err) => console.warn("Drugs sync notice:", err));

    const unsubPurchases = onSnapshot(collection(db, 'purchases'), (snap) => {
      setPurchases(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRecord)));
    }, (err) => console.warn("Purchases sync notice:", err));

    const unsubDispenses = onSnapshot(collection(db, 'dispense_records'), (snap) => {
      setDispenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DispenseRecord)));
    }, (err) => console.warn("Dispenses sync notice:", err));

    const unsubAudits = onSnapshot(collection(db, 'audits'), (snap) => {
      setAudits(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditReport)));
    }, (err) => console.warn("Audits sync notice:", err));

    const unsubDisposals = onSnapshot(collection(db, 'disposals'), (snap) => {
      setDisposals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DisposalRecord)));
    }, (err) => console.warn("Disposals sync notice:", err));

    const unsubExpenses = onSnapshot(collection(db, 'operating_expenses'), (snap) => {
      setExpenses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as OperatingExpense)));
    }, (err) => console.warn("Expenses sync notice:", err));

    const unsubBranches = onSnapshot(collection(db, 'branches'), (snapshot) => {
      setBranches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile)));
    }, (err) => console.warn("Users sync notice:", err));

    const unsubStaff = onSnapshot(collection(db, 'staff_roles'), (snap) => {
      setStaffRoles(snap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          email: data.email || (doc.id && doc.id.includes('@') ? doc.id : ''),
          name: data.name || '',
          role: (data.role || 'pending') as Role,
          ...data
        };
      }));
    }, (err) => console.warn("Staff roles sync notice:", err));

    return () => {
      unsubDrugs();
      unsubPurchases();
      unsubDispenses();
      unsubAudits();
      unsubDisposals();
      unsubExpenses();
      unsubUsers();
      unsubStaff();
    };
  }, []);

  const combinedUsers = useMemo(() => {
    const emailToUser = new Map<string, any>();

    // 1. Registered users from `users` collection
    for (const u of users) {
      const email = (u.email || '').trim().toLowerCase();
      if (!email) continue;

      const staffEntry = staffRoles.find(s => (s.email || s.id || '').trim().toLowerCase() === email);
      // Prioritize explicit role override, then non-pending staff role assignment, then user doc role
      const staffRoleVal = staffEntry?.role;
      const userRoleVal = u.role;
      const computedRole = (staffRoleVal && staffRoleVal !== 'pending')
        ? staffRoleVal
        : (userRoleVal || staffRoleVal || 'pending');

      const explicitRole = (roleOverrides[email] || roleOverrides[u.id] || computedRole) as Role;

      emailToUser.set(email, {
        id: u.id,
        email: u.email,
        name: u.name || staffEntry?.name || email.split('@')[0],
        role: explicitRole,
        isRegistered: true,
        locationId: u.locationId || staffEntry?.locationId
      });
    }

    // 2. Pre-registered staff from `staff_roles` collection not yet registered in `users`
    for (const staff of staffRoles) {
      const email = (staff.email || (staff.id && staff.id.includes('@') ? staff.id : '')).trim().toLowerCase();
      if (!email) continue;

      if (!emailToUser.has(email)) {
        const explicitRole = (roleOverrides[email] || roleOverrides[staff.id] || staff.role || 'pending') as Role;
        emailToUser.set(email, {
          id: staff.id,
          email: staff.email || email,
          name: staff.name || 'Pre-registered Staff',
          role: explicitRole,
          isRegistered: false,
          locationId: staff.locationId
        });
      }
    }

    return Array.from(emailToUser.values());
  }, [users, staffRoles, roleOverrides]);

  const handleAddDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrugName.trim() || !newDrugCategory.trim()) return;
    try {
      const drugRef = doc(collection(db, 'drugs'));
      await setDoc(drugRef, {
        name: newDrugName.trim(),
        branchStock: { central: 0 },
        
        unit: newDrugUnit.trim() || 'units',
        category: newDrugCategory,
        createdAt: Date.now()
      });
      setNewDrugName('');
      setNewDrugUnit('');
      setNewDrugCategory('');
      alert('Drug registered successfully. Current selling prices can now be managed in the Financial & Expense Centre.');
    } catch (err) {
      console.error(err);
      alert('Error adding drug');
    }
  };

  const handleStartEditDrugPrice = (drug: Drug) => {
    setEditingDrugId(drug.id);
    setEditCostPrice(drug.costPrice !== undefined ? drug.costPrice : '');
    setEditSellingPrice(drug.sellingPrice !== undefined ? drug.sellingPrice : '');
  };

  const handleSaveDrugPrice = async (drugId: string) => {
    try {
      const costVal = typeof editCostPrice === 'number' ? editCostPrice : null;
      const sellVal = typeof editSellingPrice === 'number' ? editSellingPrice : null;
      await setDoc(doc(db, 'drugs', drugId), {
        costPrice: costVal,
        sellingPrice: sellVal,
        
        lastPriceUpdatedBy: profile?.name || profile?.email || 'Admin'
      }, { merge: true });
      setEditingDrugId(null);
    } catch (err: any) {
      console.error('Error updating prices:', err);
      alert('Failed to update pricing: ' + (err?.message || 'Check network'));
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDrug || !purchaseQuantity || Number(purchaseQuantity) <= 0) return;
    try {
      const drug = drugs.find(d => d.id === selectedDrug);
      if (!drug) return;

      const qty = Number(purchaseQuantity);
      const unitCost = typeof purchaseUnitCostPrice === 'number' ? purchaseUnitCostPrice : (drug.costPrice || 0);
      const totalCost = unitCost * qty;

      const purchasePayload: any = {
        adminId: profile.id,
        adminName: profile.name,
        drugId: drug.id,
        drugName: drug.name,
        quantityPurchased: qty,
        unitCostPrice: unitCost,
        totalCost: totalCost,
        createdAt: Date.now()
      };
      if (purchaseSupplier.trim()) {
        purchasePayload.supplier = purchaseSupplier.trim();
      }
      if (purchaseInvoiceNumber.trim()) {
        purchasePayload.invoiceNumber = purchaseInvoiceNumber.trim();
      }
      if (purchaseExpiryDate) {
        purchasePayload.expiryDate = purchaseExpiryDate;
      }

      await addDoc(collection(db, 'purchases'), purchasePayload);

      // Update inventory store quantity & optionally update drug default cost price if given
      const drugRef = doc(db, 'drugs', drug.id);
      const updates: any = {
        'branchStock.central': increment(qty)
      };
      if (typeof purchaseUnitCostPrice === 'number' && purchaseUnitCostPrice > 0) {
        updates.costPrice = purchaseUnitCostPrice;
      }
      await updateDoc(drugRef, updates);
      
      setSelectedDrug('');
      setPurchaseQuantity('');
      setPurchaseUnitCostPrice('');
      setPurchaseSupplier('');
      setPurchaseInvoiceNumber('');
      setPurchaseExpiryDate('');
      alert('Stock purchase intake & cost recorded successfully!');
    } catch (err) {
      console.error(err);
      alert('Error adding purchase');
    }
  };

  const handleAddDisposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalDrug || disposalQuantity <= 0) return;
    
    try {
      const drug = drugs.find(d => d.id === disposalDrug);
      if (!drug) return;
      
      await addDoc(collection(db, 'disposals'), {
        adminId: profile.id,
        adminName: profile.name,
        drugId: drug.id,
        drugName: drug.name,
        quantityDisposed: disposalQuantity,
        reason: disposalReason,
        notes: disposalNotes,
        createdAt: Date.now()
      });
      
      // Update inventory (deduct disposed qty from system stock)
      const drugRef = doc(db, 'drugs', drug.id);
      const drugSnap = await getDoc(drugRef);
      if (drugSnap.exists()) {
        const d = drugSnap.data();
        const currentQty = d.branchStock?.['central'] || 0;
        const newQty = currentQty - disposalQuantity;
        
        await updateDoc(drugRef, {
          'branchStock.central': newQty
        });
        
        if (newQty <= 3 && newQty < currentQty) {
          fetch('/api/notify-low-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drugName: drug.name,
              quantity: newQty
            })
          }).catch(e => console.error("Failed to notify low stock", e));
        }
      }
      
      setDisposalDrug('');
      setDisposalQuantity(0);
      setDisposalNotes('');
      setDisposalReason('expired');
      alert('Drug disposal recorded successfully');
    } catch (err) {
      console.error(err);
      alert('Error recording disposal');
    }
  };

  const handleAddAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditDrug || !auditUserId || auditMissingQty <= 0) return;
    try {
      const drug = drugs.find(d => d.id === auditDrug);
      const user = users.find(u => u.id === auditUserId);
      if (!drug || !user) return;

      await addDoc(collection(db, 'audits'), {
        adminId: profile.id,
        drugId: drug.id,
        drugName: drug.name,
        expectedQuantity: 0,
        actualQuantity: 0,
        discrepancy: auditMissingQty,
        responsibleUserId: user.id,
        responsibleUserName: user.name,
        notes: auditNotes,
        createdAt: Date.now()
      });

      const drugRef = doc(db, 'drugs', drug.id);
      const drugSnap = await getDoc(drugRef);
      if (drugSnap.exists()) {
        const d = drugSnap.data();
        const currentQty = d.branchStock?.['central'] || 0;
        const newQty = currentQty - auditMissingQty;
        
        await updateDoc(drugRef, {
          'branchStock.central': newQty
        });

        if (newQty <= 3 && newQty < currentQty) {
          fetch('/api/notify-low-stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              drugName: drug.name,
              quantity: newQty
            })
          }).catch(e => console.error("Failed to notify low stock", e));
        }
      } else {
        await updateDoc(drugRef, {
          'branchStock.central': increment(-auditMissingQty)
        });
      }
      
      setAuditDrug('');
      setAuditMissingQty(0);
      setAuditUserId('');
      setAuditNotes('');
      alert('Missing inventory report filed.');
    } catch (err) {
      console.error(err);
      alert('Error adding audit report');
    }
  };

  
  const handleLocationChange = async (userId, isRegistered, email, locationId) => {
    try {
      const emailKey = (email || '').trim().toLowerCase();
      
      if (isRegistered && userId) {
        await setDoc(doc(db, 'users', userId), { locationId }, { merge: true });
      }
      
      if (emailKey) {
        const matchingUsers = users.filter(u => (u.email || '').trim().toLowerCase() === emailKey);
        for (const mu of matchingUsers) {
          await setDoc(doc(db, 'users', mu.id), { locationId }, { merge: true });
        }
        await setDoc(doc(db, 'staff_roles', emailKey), { locationId }, { merge: true });
      }
    } catch (err) {
      alert('Error updating location: ' + err.message);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string, isRegistered: boolean, userEmail?: string) => {
    const emailKey = (userEmail || '').trim().toLowerCase();
    const targetKey = emailKey || userId;
    const roleVal = newRole as Role;
    
    // Immediate optimistic UI update across all references
    setRoleOverrides(prev => ({ ...prev, [targetKey]: roleVal, ...(emailKey ? { [emailKey]: roleVal } : {}), ...(userId ? { [userId]: roleVal } : {}) }));
    setUpdatingUserIds(prev => ({ ...prev, [targetKey]: true }));
    setRoleSuccessMessage(null);

    // Update local state arrays immediately so combinedUsers recalculates instantaneously
    setStaffRoles(prev => {
      const idx = prev.findIndex(s => (s.email || s.id || '').trim().toLowerCase() === emailKey || s.id === userId);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], role: roleVal };
        return copy;
      }
      return [...prev, { id: emailKey || userId, email: emailKey, role: roleVal }];
    });

    setUsers(prev => {
      return prev.map(u => {
        if ((u.email || '').trim().toLowerCase() === emailKey || u.id === userId) {
          return { ...u, role: roleVal };
        }
        return u;
      });
    });

    try {
      // 1. Update in `users` collection if user is registered or exists
      if (isRegistered && userId) {
        await setDoc(doc(db, 'users', userId), { role: roleVal, email: emailKey || undefined }, { merge: true });
      }
      
      // Update any matching users in users collection by email
      if (emailKey) {
        const matchingUsers = users.filter(u => (u.email || '').trim().toLowerCase() === emailKey);
        for (const mu of matchingUsers) {
          await setDoc(doc(db, 'users', mu.id), { role: roleVal }, { merge: true });
        }
      }

      // 2. Update in `staff_roles` collection by normalized email
      if (emailKey) {
        await setDoc(doc(db, 'staff_roles', emailKey), {
          email: emailKey,
          role: roleVal,
          
        }, { merge: true });
      }

      setRoleSuccessMessage(`Role successfully updated to ${roleVal.toUpperCase()} for ${emailKey || userId}`);
      setTimeout(() => setRoleSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('Role update error:', err);
      // Revert optimistic override on error
      setRoleOverrides(prev => {
        const copy = { ...prev };
        delete copy[targetKey];
        if (emailKey) delete copy[emailKey];
        if (userId) delete copy[userId];
        return copy;
      });
      alert('Error updating user role: ' + (err?.message || 'Check network / permissions'));
    } finally {
      setUpdatingUserIds(prev => ({ ...prev, [targetKey]: false }));
    }
  };

  const handleDeleteUser = async (userId: string, isRegistered: boolean, email: string) => {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (normalizedEmail === 'oreloretechcustomerservice@gmail.com' || normalizedEmail === 'olatokeoluwole@gmail.com') {
      alert("This super admin account cannot be deleted.");
      return;
    }
    
    if (!window.confirm(`Are you sure you want to delete user ${email}?`)) {
      return;
    }

    // Instantly remove from local lists for zero-latency UI removal
    setUsers(prev => prev.filter(u => u.id !== userId && (u.email || '').trim().toLowerCase() !== normalizedEmail));
    setStaffRoles(prev => prev.filter(s => s.id !== userId && (s.email || '').trim().toLowerCase() !== normalizedEmail));
    setRoleOverrides(prev => {
      const copy = { ...prev };
      delete copy[normalizedEmail];
      delete copy[userId];
      return copy;
    });

    try {
      if (isRegistered && userId) {
        await deleteDoc(doc(db, 'users', userId));
      }
      if (normalizedEmail) {
        await deleteDoc(doc(db, 'staff_roles', normalizedEmail));
      }
      setRoleSuccessMessage(`Deleted user ${email}`);
      setTimeout(() => setRoleSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Delete user error:', err);
      alert('Error deleting user: ' + (err?.message || ''));
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim() || !staffRole || isRegisteringStaff) return;

    try {
      setIsRegisteringStaff(true);
      const normalizedEmail = staffEmail.trim().toLowerCase();
      const staffDocData = {
        email: normalizedEmail,
        name: staffName.trim() || normalizedEmail.split('@')[0],
        role: staffRole, locationId: staffRole === 'branch' ? staffLocationId : '',
        createdAt: Date.now(),
        
      };

      // Optimistically update local staffRoles & roleOverrides state
      setStaffRoles(prev => {
        const filtered = prev.filter(s => (s.email || s.id || '').trim().toLowerCase() !== normalizedEmail);
        return [...filtered, { id: normalizedEmail, ...staffDocData }];
      });
      setRoleOverrides(prev => ({ ...prev, [normalizedEmail]: staffRole }));

      await setDoc(doc(db, 'staff_roles', normalizedEmail), staffDocData, { merge: true });

      // If this user is already registered in users collection, update their role immediately
      const existingUser = users.find(u => (u.email || '').trim().toLowerCase() === normalizedEmail);
      if (existingUser) {
        await setDoc(doc(db, 'users', existingUser.id), { role: staffRole }, { merge: true });
        setUsers(prev => prev.map(u => u.id === existingUser.id ? { ...u, role: staffRole } : u));
      }

      setStaffEmail('');
      setStaffName('');
      setStaffRole('doctor');
      setRoleSuccessMessage(`Staff ${normalizedEmail} registered with role ${staffRole.toUpperCase()} successfully!`);
      setTimeout(() => setRoleSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert('Error registering staff: ' + (err?.message || 'Check permissions'));
    } finally {
      setIsRegisteringStaff(false);
    }
  };

  const { activeBatches, expiryChartData } = useMemo(() => {
    const batches: any[] = [];
    drugs.forEach(drug => {
      const drugPurchases = purchases.filter(p => p.drugId === drug.id);
      const totalDispensed = dispenses.filter(d => d.drugId === drug.id).reduce((sum, d) => sum + d.quantityDispensed, 0);
      const totalLost = audits.filter(a => a.drugId === drug.id).reduce((sum, a) => sum + a.discrepancy, 0);
      const totalDisposed = disposals.filter(d => d.drugId === drug.id).reduce((sum, d) => sum + d.quantityDisposed, 0);
      
      let remainingToDeduct = totalDispensed + totalLost + totalDisposed;
      const sortedPurchases = [...drugPurchases].sort((a, b) => {
        const aExpiry = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
        const bExpiry = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
        return a.createdAt - b.createdAt;
      });

      for (const p of sortedPurchases) {
        let remainingQty = 0;
        if (remainingToDeduct >= p.quantityPurchased) {
          remainingToDeduct -= p.quantityPurchased;
          remainingQty = 0;
        } else {
          remainingQty = p.quantityPurchased - remainingToDeduct;
          remainingToDeduct = 0;
        }
        
        batches.push({
          id: p.id,
          drugName: drug.name,
          unit: drug.unit,
          quantityPurchased: p.quantityPurchased,
          remainingQuantity: remainingQty,
          createdAt: p.createdAt,
          expiryDate: p.expiryDate || ''
        });
      }
    });

    batches.sort((a, b) => {
      const timeA = a.expiryDate ? new Date(a.expiryDate).getTime() : Infinity;
      const timeB = b.expiryDate ? new Date(b.expiryDate).getTime() : Infinity;
      if (timeA !== timeB) return timeA - timeB;
      return b.createdAt - a.createdAt;
    });

    const chartData = [];
    const now = new Date();
    
    let alreadyExpiredCount = 0;
    batches.forEach(b => {
      if (!b.expiryDate || b.remainingQuantity <= 0) return;
      const expiry = new Date(b.expiryDate);
      if (expiry < new Date(now.getFullYear(), now.getMonth(), 1)) {
        alreadyExpiredCount++;
      }
    });

    chartData.push({
      name: 'Expired',
      count: alreadyExpiredCount
    });

    for (let i = 0; i < 11; i++) {
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = format(targetMonth, 'MMM yyyy');
      
      let expiringCount = 0;
      batches.forEach(b => {
        if (!b.expiryDate || b.remainingQuantity <= 0) return;
        const expiry = new Date(b.expiryDate);
        if (expiry.getFullYear() === targetMonth.getFullYear() && expiry.getMonth() === targetMonth.getMonth()) {
          expiringCount++;
        }
      });
      
      chartData.push({
        name: monthStr,
        count: expiringCount
      });
    }

    return { activeBatches: batches, expiryChartData: chartData };
  }, [drugs, purchases, dispenses, audits, disposals]);

  // Quick Financial totals for top overview
  const totalSalesRevenue = useMemo(() => {
    return dispenses.reduce((sum, d) => {
      if (d.totalAmount !== undefined) return sum + d.totalAmount;
      if (d.unitPrice !== undefined) return sum + (d.quantityDispensed * d.unitPrice);
      const drug = drugs.find(item => item.id === d.drugId);
      return sum + (d.quantityDispensed * (drug?.sellingPrice || 0));
    }, 0);
  }, [dispenses, drugs]);

  const totalDrugExpenditure = useMemo(() => {
    return purchases.reduce((sum, p) => {
      if (p.totalCost !== undefined) return sum + p.totalCost;
      if (p.unitCostPrice !== undefined) return sum + (p.quantityPurchased * p.unitCostPrice);
      const drug = drugs.find(item => item.id === p.drugId);
      return sum + (p.quantityPurchased * (drug?.costPrice || 0));
    }, 0);
  }, [purchases, drugs]);

  const totalOpex = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [expenses]);

  return (
    <div className="flex flex-col gap-4">
      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-300 overflow-x-auto bg-white px-2 rounded-t-lg">
        <button
          className={`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'admin' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('admin')}
        >
          <Package className="w-3.5 h-3.5" />
          Admin Dashboard
        </button>
        <button
          className={`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'analytics' ? 'border-b-2 border-blue-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          BI View
        </button>

        <button
          className={`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'finance' ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('finance')}
        >
          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
          Financial & Expense Center
        </button>

        <button
          className={`px-4 py-3 font-bold text-xs uppercase flex items-center gap-1.5 whitespace-nowrap transition-colors ${
            activeTab === 'expiry' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('expiry')}
        >
          <Clock className="w-3.5 h-3.5" />
          Expiry Monitor
        </button>

        <button
          className={`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'branches' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('branches')}
        >
          Branches
        </button>
        <button
          className={`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors flex items-center gap-1.5 ${
            activeTab === 'branch_transactions' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('branch_transactions')}
        >
          Branch Transactions
        </button>
        <button
          className={`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors ${
            activeTab === 'store' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('store')}
        >
          Store View (Read Only)
        </button>

        <button
          className={`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors ${
            activeTab === 'branch' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('branch')}
        >
          Branch View (Read Only)
        </button>

        <button
          className={`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors ${
            activeTab === 'doctor' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('doctor')}
        >
          Doctor View (Read Only)
        </button>

        <button
          className={`px-4 py-3 font-bold text-xs uppercase whitespace-nowrap transition-colors ${
            activeTab === 'hmo' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('hmo')}
        >
          HMO View (Read Only)
        </button>
      </div>

      {/* TAB: Analytics Dashboard */}
      {activeTab === 'analytics' && (
        <AnalyticsView
          profile={profile}
          drugs={drugs}
          purchases={purchases}
          dispenses={dispenses}
        />
      )}

      {/* TAB: Financial Management */}
      {activeTab === 'finance' && (
        <FinanceView
          profile={profile}
          drugs={drugs}
          purchases={purchases}
          dispenses={dispenses}
          expenses={expenses}
          currencySymbol="₦"
        />
      )}

      {/* TAB: Admin Operations Dashboard */}
      
      
      {activeTab === 'branch_transactions' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800">Branch Transactions</h2>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Branch</th>
                  <th className="p-3">Patient</th>
                  <th className="p-3">Item(s)</th>
                  <th className="p-3 text-right">Total (₦)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispenseRecords
                  .filter(r => !selectedBranchId || r.branchId === selectedBranchId)
                  .map(record => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="p-3 text-slate-500">{new Date(record.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-medium text-slate-700">{record.branchName || 'Unknown Branch'}</td>
                    <td className="p-3 text-slate-700">{record.patientName || 'Direct Sale'}</td>
                    <td className="p-3 text-slate-600">
                      {record.drugs ? record.drugs.map((d: any) => `${d.drugName} (x${d.quantity})`).join(', ') : (record.drugName + ' (x' + (record.quantityDispensed || record.quantity || 0) + ')')}
                    </td>
                    <td className="p-3 text-right font-medium text-slate-800">
                      {(() => {
                        let total = record.totalAmount;
                        if (total === undefined || total === null || total === 0) {
                          const unitPrice = record.unitPrice || drugs.find(d => d.id === record.drugId)?.sellingPrice || 0;
                          total = unitPrice * (record.quantityDispensed || record.quantity || 0);
                        }
                        return total.toLocaleString();
                      })()}
                    </td>
                  </tr>
                ))}
                {dispenseRecords.filter(r => !selectedBranchId || r.branchId === selectedBranchId).length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">No transactions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Register New Branch</h2>
            <form onSubmit={handleAddBranch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input
                  type="text"
                  required
                  placeholder="Branch Name (e.g. Branch C)"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newBranchEmail}
                  onChange={(e) => setNewBranchEmail(e.target.value)}
                  className="p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded text-sm transition-colors"
              >
                Register Branch
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <h2 className="text-lg font-bold text-slate-800 p-4 border-b border-slate-100">Registered Branches</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-600 font-medium">
                  <tr>
                    <th className="p-4">Name</th>
                    <th className="p-4">Address</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branches.map(b => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-slate-800">{b.name}</td>
                      <td className="p-4 text-slate-600">{b.address}</td>
                      <td className="p-4 text-slate-600">{b.email}</td>
                      <td className="p-4">
                        <button onClick={() => handleDeleteBranch(b.id)} className="text-red-500 hover:text-red-700 font-medium">Delete</button>
                      </td>
                    </tr>
                  ))}
                  {branches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">No branches registered.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Registration & Intake Forms */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Register New Drug */}
            <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                  <Package className="w-4 h-4 mr-2" />
                  Control Unit (Admin)
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setIsImportModalOpen(true)} className="px-2 py-1 bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 rounded text-[10px] font-bold flex items-center transition-colors">
                    Import CSV
                  </button>
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">Supply Chain</span>
                </div>
              </div>
              <div className="p-4 flex-1 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase">Register New Drug / Item</h3>
                  <form onSubmit={handleAddDrug} className="space-y-2 text-xs">
                    <input
                      type="text"
                      required
                      placeholder="Item Name (e.g. Paracetamol, Amoxicillin, Gloves)"
                      value={newDrugName}
                      onChange={e => setNewDrugName(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newDrugUnit}
                        onChange={e => setNewDrugUnit(e.target.value.replace(/[0-9]/g, ''))}
                        placeholder="Unit (e.g. pills, packs)"
                        className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400"
                      />
                      <input
                        type="text"
                        required
                        value={newDrugCategory}
                        onChange={e => setNewDrugCategory(e.target.value)}
                        placeholder="Category (required)"
                        className="w-full p-2 border border-slate-300 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-900 transition-colors mt-2"
                    >
                      Register Drug
                    </button>
                  </form>
                </div>

                {/* Inventory Intake Form */}
                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Inventory Intake & Purchase Cost
                  </h3>
                  <form onSubmit={handleAddPurchase} className="space-y-2 text-xs">
                    <select
                      required
                      value={selectedDrug}
                      onChange={e => {
                        const drugId = e.target.value;
                        setSelectedDrug(drugId);
                        const sel = drugs.find(d => d.id === drugId);
                        if (sel && sel.costPrice) {
                          setPurchaseUnitCostPrice(sel.costPrice);
                        }
                      }}
                      className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                    >
                      <option value="">-- Select Drug --</option>
                      {drugs.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.unit || 'unit'})</option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        required
                        min="1"
                        step="1"
                        placeholder="Quantity"
                        value={purchaseQuantity}
                        onChange={e => setPurchaseQuantity(e.target.value === '' ? '' : parseInt(e.target.value))}
                        className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                      />
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Unit Cost Price (₦)"
                        value={purchaseUnitCostPrice}
                        onChange={e => setPurchaseUnitCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Supplier (Optional)"
                        value={purchaseSupplier}
                        onChange={e => setPurchaseSupplier(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                      />
                      <input
                        type="date"
                        title="Expiry Date"
                        value={purchaseExpiryDate}
                        onChange={e => setPurchaseExpiryDate(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 text-slate-500"
                      />
                    </div>

                    {purchaseQuantity && purchaseUnitCostPrice ? (
                      <div className="p-2 bg-indigo-50 border border-indigo-200 rounded text-[11px] font-bold text-indigo-900 flex justify-between">
                        <span>Total Purchase Cost:</span>
                        <span>₦{(Number(purchaseQuantity) * Number(purchaseUnitCostPrice)).toLocaleString()}</span>
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      className="w-full px-4 py-2 bg-slate-800 text-white rounded text-xs font-bold hover:bg-slate-900 transition-colors flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Stock & Record Expenditure
                    </button>
                  </form>
                </div>
              </div>
            </section>

            {/* Audit Form Section */}
            <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                  <UserX className="w-4 h-4 mr-2" /> Loss Prevention
                </h2>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">Audit Desk</span>
              </div>
              <div className="p-4 flex-1">
                <form onSubmit={handleAddAudit} className="space-y-3">
                  <select
                    required
                    value={auditDrug}
                    onChange={e => setAuditDrug(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                  >
                    <option value="">-- Select Drug --</option>
                    {drugs.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Missing Qty"
                      value={auditMissingQty || ''}
                      onChange={e => setAuditMissingQty(parseInt(e.target.value))}
                      className="w-full sm:w-1/3 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                    />
                    <select
                      required
                      value={auditUserId}
                      onChange={e => setAuditUserId(e.target.value)}
                      className="flex-1 p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                    >
                      <option value="">-- Responsible Person --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Notes/Reason..."
                    value={auditNotes}
                    onChange={e => setAuditNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-red-600 text-white rounded text-xs font-bold shadow-sm hover:bg-red-700 transition-colors flex items-center justify-center"
                  >
                    <AlertTriangle className="w-3 h-3 mr-2" />
                    Log Missing Item
                  </button>
                </form>
              </div>
            </section>

            {/* Drug Disposal Section */}
            <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                  <Trash2 className="w-4 h-4 mr-2" /> Drug Disposal
                </h2>
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-[10px] font-bold">Waste Desk</span>
              </div>
              <div className="p-4 flex-1">
                <form onSubmit={handleAddDisposal} className="space-y-3">
                  <select
                    required
                    value={disposalDrug}
                    onChange={e => setDisposalDrug(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                  >
                    <option value="">-- Select Drug --</option>
                    {drugs.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="Disposed Qty"
                      value={disposalQuantity || ''}
                      onChange={e => setDisposalQuantity(parseInt(e.target.value))}
                      className="w-full sm:w-1/3 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                    />
                    <select
                      required
                      value={disposalReason}
                      onChange={e => setDisposalReason(e.target.value)}
                      className="flex-1 p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-slate-400"
                    >
                      <option value="expired">Expired</option>
                      <option value="damaged">Damaged / Broken</option>
                      <option value="recalled">Recalled</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Notes (e.g. batch number)..."
                    value={disposalNotes}
                    onChange={e => setDisposalNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-orange-600 text-white rounded text-xs font-bold shadow-sm hover:bg-orange-700 transition-colors flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3 mr-2" />
                    Record Disposal
                  </button>
                </form>
              </div>
            </section>
          </div>

          {/* Dashboard & Reporting */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Quick KPI Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div 
                onClick={() => setActiveTab('finance')}
                className="bg-emerald-700 text-white p-3.5 rounded-xl shadow-sm cursor-pointer hover:bg-emerald-800 transition-all flex flex-col justify-between"
              >
                <div className="text-[10px] text-emerald-200 uppercase tracking-wider font-bold">Total Sales Income</div>
                <div className="text-xl font-black mt-1">₦{totalSalesRevenue.toLocaleString()}</div>
                <div className="text-[10px] text-emerald-200 mt-1">Click to view financial ledger &rarr;</div>
              </div>

              <div 
                onClick={() => setActiveTab('finance')}
                className="bg-blue-800 text-white p-3.5 rounded-xl shadow-sm cursor-pointer hover:bg-blue-900 transition-all flex flex-col justify-between"
              >
                <div className="text-[10px] text-blue-200 uppercase tracking-wider font-bold">Drug Purchases Cost</div>
                <div className="text-xl font-black mt-1">₦{totalDrugExpenditure.toLocaleString()}</div>
                <div className="text-[10px] text-blue-200 mt-1">Inventory acquisition cost &rarr;</div>
              </div>

              <div 
                onClick={() => setActiveTab('finance')}
                className="bg-orange-600 text-white p-3.5 rounded-xl shadow-sm cursor-pointer hover:bg-orange-700 transition-all flex flex-col justify-between"
              >
                <div className="text-[10px] text-orange-200 uppercase tracking-wider font-bold">Operating Expenses</div>
                <div className="text-xl font-black mt-1">₦{totalOpex.toLocaleString()}</div>
                <div className="text-[10px] text-orange-200 mt-1">Salaries, fuel, repairs & utilities &rarr;</div>
              </div>
            </div>

            {/* User Role Management */}
            <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
                    <Users className="w-4 h-4 mr-2 text-indigo-600" /> User Role Management
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-0.5">Assign system permissions, pre-register team members, or modify existing user access</p>
                </div>
                {roleSuccessMessage && (
                  <div className="flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    {roleSuccessMessage}
                  </div>
                )}
              </div>
              <div className="p-4 border-b border-slate-200 bg-white">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase mb-3">Pre-register New Staff</h3>
                <form onSubmit={handleAddStaff} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <input
                    type="text"
                    placeholder="Full Name (Optional)"
                    value={staffName}
                    onChange={e => setStaffName(e.target.value)}
                    className="w-full sm:flex-1 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="email"
                    required
                    placeholder="Email Address"
                    value={staffEmail}
                    onChange={e => setStaffEmail(e.target.value)}
                    className="w-full sm:flex-1 p-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <select
                    required
                    value={staffRole}
                    onChange={e => setStaffRole(e.target.value as Role)}
                    className="w-full sm:w-36 p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                  >
                    <option value="hmo">HMO</option>
                                <option value="doctor">Doctor</option>
                    <option value="branch">Branch</option>
                    <option value="store">Store</option>
                    <option value="admin">Admin</option>
                    <option value="pending">Pending Approval</option>
                  </select>
                  
                  {staffRole === 'branch' && (
                    <select
                      required
                      value={staffLocationId}
                      onChange={e => setStaffLocationId(e.target.value)}
                      className="w-full sm:w-36 p-2 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer"
                    >
                      <option value="">Select Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}

                  <button
                    type="submit"
                    disabled={isRegisteringStaff}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition-colors whitespace-nowrap shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isRegisteringStaff && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    {isRegisteringStaff ? 'Registering...' : 'Register Staff'}
                  </button>
                </form>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Current Role</th>
                      <th className="px-4 py-3 text-right">Assign Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {combinedUsers.map(u => {
                      const emailKey = (u.email || '').trim().toLowerCase();
                      const targetKey = emailKey || u.id;
                      const currentRole = (roleOverrides[targetKey] || u.role || 'pending') as Role;
                      const isUpdating = updatingUserIds[targetKey] || false;
                      const isProtectedAdmin = emailKey === 'oreloretechcustomerservice@gmail.com' || emailKey === 'olatokeoluwole@gmail.com';

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {u.name}
                            {!u.isRegistered && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                Pre-registered
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                              currentRole === 'admin' ? 'bg-purple-100 text-purple-700' :
                              currentRole === 'doctor' ? 'bg-indigo-100 text-indigo-700' :
                              currentRole === 'branch' ? 'bg-orange-100 text-orange-700' :
                              currentRole === 'store' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-200 text-slate-700'
                            }`}>
                              {currentRole.toUpperCase()}
                            
                            </span>
                            {currentRole === 'branch' && u.locationId && (
                              <span className="ml-2 text-[10px] text-slate-500 font-medium">
                                {branches.find(b => b.id === u.locationId)?.name || u.locationId}
                              </span>
                            )}

                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isUpdating && (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                              )}
                              <select
                                value={currentRole}
                                onChange={(e) => handleRoleChange(u.id, e.target.value, u.isRegistered, u.email)}
                                aria-label={`Select role for ${u.email || u.name}`}
                                className="p-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium cursor-pointer shadow-sm"
                              >
                                <option value="pending">Pending</option>
                                <option value="hmo">HMO</option>
                                <option value="doctor">Doctor</option>
                                <option value="branch">Branch</option>
                                <option value="store">Store</option>
                                <option value="admin">Admin</option>
                              </select>
                              {currentRole === 'branch' && (
                                <select
                                  value={u.locationId || ''}
                                  onChange={(e) => handleLocationChange(u.id, u.isRegistered, u.email, e.target.value)}
                                  className="p-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-medium cursor-pointer shadow-sm ml-2"
                                >
                                  <option value="">Select Branch</option>
                                  {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              )}

                              <button
                                onClick={() => handleDeleteUser(u.id, u.isRegistered, u.email)}
                                disabled={isUpdating || isProtectedAdmin}
                                className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-red-200"
                                title={isProtectedAdmin ? "Super Admin cannot be deleted" : "Delete User"}
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Inventory & Discrepancy Report Table with Pricing */}
            <section className="flex-1 flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="font-bold text-slate-700 uppercase text-xs">Inventory & Pricing Report</h2>
                  <span className="text-[10px] text-slate-500">Track stock balance, cost prices, and selling prices</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Search drugs..."
                    value={inventorySearchTerm}
                    onChange={(e) => setInventorySearchTerm(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 w-full sm:w-48"
                  />
                  <select
                    value={inventoryCategoryFilter}
                    onChange={(e) => setInventoryCategoryFilter(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 w-full sm:w-auto"
                  >
                    <option value="all">All Categories</option>
                    <option value="medication">Medication</option>
                    <option value="consumable">Consumable</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200 text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3 text-right">Cost Price (₦)</th>
                      <th className="px-4 py-3 text-right">Selling Price (₦)</th>
                      <th className="px-4 py-3 text-right">Purchased</th>
                      <th className="px-4 py-3 text-right">Dispensed</th>
                      <th className="px-4 py-3 text-right">Store Qty</th>
                      <th className="px-4 py-3 text-right">Disp Qty</th>
                      <th className="px-4 py-3 text-right">System Total</th>
                      <th className="px-4 py-3 text-right">Unaccounted</th>
                      <th className="px-4 py-3 text-center">Pricing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {drugs.filter(drug => {
                      const matchesSearch = drug.name.toLowerCase().includes(inventorySearchTerm.toLowerCase());
                      const matchesCategory = inventoryCategoryFilter === 'all' || (drug.category || 'medication') === inventoryCategoryFilter;
                      return matchesSearch && matchesCategory;
                    }).map(drug => {
                      const drugPurchases = purchases.filter(p => p.drugId === drug.id);
                      const totalPurchased = drugPurchases.reduce((sum, p) => sum + p.quantityPurchased, 0);
                      const totalDispensed = dispenses.filter(d => d.drugId === drug.id).reduce((sum, d) => sum + d.quantityDispensed, 0);
                      const totalLost = audits.filter(a => a.drugId === drug.id).reduce((sum, a) => sum + a.discrepancy, 0);
                      const totalDisposed = disposals.filter(d => d.drugId === drug.id).reduce((sum, d) => sum + d.quantityDisposed, 0);
                      
                      const expectedStock = totalPurchased - totalDispensed - totalLost - totalDisposed;
                      const storeQty = drug.branchStock?.['central'] || 0;
                      const dispQty = (Object.values(drug.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) - storeQty;
                      const systemStock = storeQty + dispQty;
                      const unaccounted = systemStock - expectedStock;

                      const isEditing = editingDrugId === drug.id;

                      return (
                        <tr key={drug.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {drug.name} <span className="text-slate-400 font-normal ml-1">({drug.unit || 'units'})</span>
                          </td>

                          {/* Cost Price */}
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={editCostPrice}
                                onChange={e => setEditCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="w-20 p-1 border border-indigo-400 rounded text-xs text-right font-bold"
                              />
                            ) : (
                              <span className="font-semibold text-slate-700">
                                {drug.costPrice ? `₦${drug.costPrice.toLocaleString()}` : '-'}
                              </span>
                            )}
                          </td>

                          {/* Selling Price */}
                          <td className="px-4 py-3 text-right">
                            {isEditing ? (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={editSellingPrice}
                                onChange={e => setEditSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                className="w-20 p-1 border border-indigo-400 rounded text-xs text-right font-bold"
                              />
                            ) : (
                              <span className="font-extrabold text-emerald-700">
                                {drug.sellingPrice ? `₦${drug.sellingPrice.toLocaleString()}` : '-'}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right text-slate-600">{totalPurchased}</td>
                          <td className="px-4 py-3 text-right text-slate-600">{totalDispensed}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">{storeQty}</td>
                          <td className="px-4 py-3 text-right font-medium text-slate-900">{dispQty}</td>
                          <td className="px-4 py-3 text-right font-medium text-indigo-700">{systemStock}</td>
                          <td className="px-4 py-3 text-right font-bold">
                            {unaccounted !== 0 ? (
                              <span className="inline-flex items-center text-red-600 bg-red-50 px-2 py-0.5 rounded text-[10px]">
                                {unaccounted > 0 ? '+' : ''}{unaccounted}
                              </span>
                            ) : (
                              <span className="text-green-600">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => handleSaveDrugPrice(drug.id)}
                                  className="p-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded transition-colors"
                                  title="Save Prices"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingDrugId(null)}
                                  className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEditDrugPrice(drug)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                title="Edit Prices"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {drugs.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-8 text-center text-slate-500">No drugs registered yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Reports Log */}
            <section className="flex flex-col bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h2 className="font-bold text-slate-700 uppercase text-xs">Accountability & Loss Reports</h2>
              </div>
              <div className="p-4 bg-white flex flex-col gap-2 max-h-56 overflow-y-auto">
                {audits.map(audit => (
                  <div key={audit.id} className="p-3 bg-red-50 border border-red-100 rounded text-xs flex justify-between items-start">
                    <div>
                      <div className="font-bold text-red-800 mb-0.5">Missing: {audit.drugName} ({audit.discrepancy} units)</div>
                      <div className="text-slate-600 text-[11px] mb-1">Notes: {audit.notes}</div>
                      <div className="text-slate-500 text-[10px]">{format(audit.createdAt, 'MMM d, yyyy h:mm a')}</div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned To</span>
                      <span className="px-2 py-1 bg-white border border-red-200 rounded text-red-700 font-bold">
                        {audit.responsibleUserName}
                      </span>
                    </div>
                  </div>
                ))}
                {audits.length === 0 && (
                  <div className="text-center text-sm text-slate-500 py-4">No missing inventory reports filed.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'store' && <StoreView profile={profile} readOnly={true} />}
      {activeTab === 'branch' && <BranchView profile={profile} readOnly={true} />}
      {activeTab === 'doctor' && <DoctorView profile={profile} readOnly={true} />}
      {activeTab === 'hmo' && <HMOView profile={profile} readOnly={true} />}
      
      {activeTab === 'expiry' && (
        <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="font-bold text-slate-700 uppercase text-xs flex items-center">
              <Clock className="w-4 h-4 mr-2" /> Drug Expiry Monitor
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search drug batches..."
                value={expirySearchTerm}
                onChange={(e) => setExpirySearchTerm(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 w-full sm:w-48"
              />
              <select
                value={expiryStatusFilter}
                onChange={(e) => setExpiryStatusFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded text-xs focus:outline-none focus:border-slate-400 w-full sm:w-auto"
              >
                <option value="all">All Statuses</option>
                <option value="valid">Valid</option>
                <option value="expiring_soon">Expiring Soon</option>
                <option value="expired">Expired</option>
                <option value="no_expiry">No Expiry</option>
              </select>
            </div>
          </div>
          
          <div className="p-4 border-b border-slate-200 h-64">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-4">Expiry Projection (Including Already Expired)</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expiryChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1'}} />
                <Bar dataKey="count" name="Expiring Batches" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 overflow-x-auto p-4">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Drug Name</th>
                  <th className="px-4 py-3 text-right">Batch Quantity</th>
                  <th className="px-4 py-3 text-right">Remaining Quantity</th>
                  <th className="px-4 py-3 text-right">Purchase Date</th>
                  <th className="px-4 py-3 text-right">Expiry Date</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {activeBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No active batches found.
                    </td>
                  </tr>
                ) : (
                  activeBatches.filter(batch => {
                    const matchesSearch = batch.drugName.toLowerCase().includes(expirySearchTerm.toLowerCase());
                    const hasExpiry = !!batch.expiryDate;
                    const isExpired = hasExpiry && new Date(batch.expiryDate) < new Date();
                    const isExpiringSoon = hasExpiry && new Date(batch.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    
                    let matchesStatus = true;
                    if (expiryStatusFilter === 'valid') matchesStatus = hasExpiry && !isExpired && !isExpiringSoon;
                    if (expiryStatusFilter === 'expiring_soon') matchesStatus = isExpiringSoon && !isExpired;
                    if (expiryStatusFilter === 'expired') matchesStatus = isExpired;
                    if (expiryStatusFilter === 'no_expiry') matchesStatus = !hasExpiry;
                    
                    return matchesSearch && matchesStatus;
                  }).map(batch => {
                    const hasExpiry = !!batch.expiryDate;
                    const isExpired = hasExpiry && new Date(batch.expiryDate) < new Date();
                    const isExpiringSoon = hasExpiry && new Date(batch.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    return (
                      <tr key={batch.id} className={`hover:bg-slate-50 ${isExpired ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {batch.drugName} <span className="text-slate-400 font-normal ml-1">({batch.unit || 'unit'})</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">{batch.quantityPurchased}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900">{batch.remainingQuantity}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{format(batch.createdAt, 'MMM d, yyyy')}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {hasExpiry ? batch.expiryDate : <span className="text-slate-400 text-[10px] uppercase">No Expiry Date</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                           <span className={`px-2 py-1 rounded text-[10px] font-bold ${!hasExpiry ? 'bg-slate-100 text-slate-600' : isExpired ? 'bg-red-100 text-red-700' : isExpiringSoon ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                             {!hasExpiry ? 'NO EXPIRY' : isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING SOON' : 'VALID'}
                           </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <ImportDrugsModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onSuccess={() => {
          setIsImportModalOpen(false);
          alert('Inventory data imported successfully!');
        }}
      />
    </div>
  );
}
