import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Organization, DispenseRecord } from '../types';
import { db, collection, onSnapshot, addDoc, setDoc, doc, query, where, deleteDoc } from '../db';
import { supabase } from '../supabase';
import { Building2, Users, Plus, Shield, TrendingUp, Activity, X, Download, Trash2, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SuperAdminViewProps {
  profile: UserProfile;
}

export default function SuperAdminView({ profile }: SuperAdminViewProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [dispenseRecords, setDispenseRecords] = useState<any[]>([]);
  const [staffRoles, setStaffRoles] = useState<any[]>([]);
  
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const [selectedOrgForView, setSelectedOrgForView] = useState<Organization | null>(null);
  const [orgInventory, setOrgInventory] = useState<any[]>([]);

  // Pharmacy deletion states
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrgForView) return;
    const unsub = onSnapshot(query(collection(db, 'drugs'), where('organizationId', '==', selectedOrgForView.id)), (snap) => {
      setOrgInventory(snap.docs.map((d: any) => ({ ...d.data(), id: d.id })));
    });
    return unsub;
  }, [selectedOrgForView]);

  useEffect(() => {
    // Fetch organizations
    const unsubOrgs = onSnapshot(collection(db, 'organizations'), (snap) => {
      setOrganizations(snap.docs.map((d: any) => ({
        id: d.id,
        name: d.data().name,
        status: d.data().status,
        createdAt: d.data().createdAt,
        ...d.data()
      })));
    });

    // Fetch platform-wide dispense records for metrics
    const unsubDispense = onSnapshot(collection(db, 'dispense_records'), (snap) => {
      setDispenseRecords(snap.docs.map((d: any) => ({ ...d.data(), id: d.id })));
    });

    // Fetch platform-wide staff for metrics
    const unsubStaff = onSnapshot(collection(db, 'staff_roles'), (snap) => {
      setStaffRoles(snap.docs.map((d: any) => ({ ...d.data(), id: d.id })));
    });

    return () => {
      unsubOrgs();
      unsubDispense();
      unsubStaff();
    };
  }, []);

  const orgMetrics = useMemo(() => {
    const metrics: Record<string, { totalRevenue: number, staffCount: number, prescriptions: number }> = {};
    
    organizations.forEach(org => {
      metrics[org.id] = { totalRevenue: 0, staffCount: 0, prescriptions: 0 };
    });

    dispenseRecords.forEach(record => {
      if (record.organizationId && metrics[record.organizationId]) {
        metrics[record.organizationId].totalRevenue += (record.totalAmount || 0);
        metrics[record.organizationId].prescriptions += 1;
      }
    });

    staffRoles.forEach(staff => {
      if (staff.organizationId && metrics[staff.organizationId]) {
        metrics[staff.organizationId].staffCount += 1;
      }
    });

    return metrics;
  }, [organizations, dispenseRecords, staffRoles]);

  const globalMetrics = useMemo(() => {
    const orgMetricsValues = Object.values(orgMetrics) as Array<{ totalRevenue: number, staffCount: number, prescriptions: number }>;
    return {
      totalRevenue: orgMetricsValues.reduce((acc, curr) => acc + curr.totalRevenue, 0),
      totalPharmacies: organizations.length,
      totalUsers: staffRoles.length,
      totalPrescriptions: orgMetricsValues.reduce((acc, curr) => acc + curr.prescriptions, 0)
    };
  }, [orgMetrics, organizations, staffRoles]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !adminEmail.trim()) return;

    try {
      // 1. Create Organization
      const orgRef = await addDoc(collection(db, 'organizations'), {
        name: newOrgName,
        status: 'active',
        createdAt: Date.now()
      });

      // 2. Assign the admin to staff_roles for that organization
      const cleanEmail = adminEmail.trim().toLowerCase();
      await setDoc(doc(db, 'staff_roles', cleanEmail), {
        email: cleanEmail,
        role: 'admin',
        organizationId: orgRef.id,
        name: 'Pharmacy Admin',
      }, { merge: true });

      setNewOrgName('');
      setAdminEmail('');
      setShowOrgModal(false);
      setToastMessage(`Organization "${newOrgName}" onboarded! Admin assigned to ${cleanEmail}.`);
      setTimeout(() => setToastMessage(null), 5000);
      alert(`Organization "${newOrgName}" created successfully!\n\nAdmin Email: ${cleanEmail}\n\nYou can now copy and share the permanent client portal link (${window.location.origin}) with them directly.`);
    } catch (err: any) {
      alert("Error creating organization: " + err.message);
    }
  };

  const handleDeleteOrganization = async (org: Organization) => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      // 1. Delete associated staff roles & unassign users in Supabase
      try {
        await supabase.from('staff_roles').delete().eq('organization_id', org.id);
      } catch (e) {
        console.warn('Could not delete staff_roles:', e);
      }

      try {
        await supabase.from('users').update({ organization_id: null, role: 'pending' }).eq('organization_id', org.id);
      } catch (e) {
        console.warn('Could not unassign users:', e);
      }

      // 2. Clean up associated tables for this tenant
      const tablesToClean = [
        'drugs',
        'branches',
        'dispense_records',
        'prescriptions',
        'purchases',
        'operating_expenses',
        'audits',
        'disposals',
        'inter_branch_transfers'
      ];

      for (const tbl of tablesToClean) {
        try {
          await supabase.from(tbl).delete().eq('organization_id', org.id);
        } catch (e) {
          // ignore
        }
      }

      // 3. Delete organization itself
      await deleteDoc(doc(db, 'organizations', org.id));

      try {
        await supabase.from('organizations').delete().eq('id', org.id);
      } catch (e) {
        // ignore
      }

      // 4. Update local state
      setOrganizations(prev => prev.filter(o => o.id !== org.id));
      if (selectedOrgForView?.id === org.id) {
        setSelectedOrgForView(null);
      }

      setOrgToDelete(null);
      setToastMessage(`Pharmacy "${org.name}" was successfully removed.`);
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Error deleting organization:', err);
      setDeleteError(err.message || 'Failed to delete organization. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!selectedOrgForView) return;

    const doc = new jsPDF();
    const orgName = selectedOrgForView.name;
    const today = new Date();
    const monthYear = today.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Title
    doc.setFontSize(20);
    doc.text('Monthly Operational Report', 14, 22);
    doc.setFontSize(14);
    doc.text(`Organization: ${orgName}`, 14, 32);
    doc.text(`Period: ${monthYear}`, 14, 40);

    // Calculations (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentRecords = dispenseRecords.filter(r => 
      r.organizationId === selectedOrgForView.id && 
      new Date(r.timestamp) >= thirtyDaysAgo
    );

    const totalRevenue = recentRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    const totalPrescriptions = recentRecords.length;

    // Section 1: Sales & Revenue Snapshot
    doc.setFontSize(16);
    doc.text('1. Sales & Revenue Snapshot (Last 30 Days)', 14, 55);
    doc.setFontSize(12);
    doc.text(`Total Revenue: NGN ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 65);
    doc.text(`Total Transactions: ${totalPrescriptions}`, 14, 72);

    // Section 2: Inventory Alerts (Low Stock)
    doc.setFontSize(16);
    doc.text('2. Inventory Action Alerts', 14, 90);
    const lowStock = orgInventory.filter(item => item.quantity < 20);
    
    if (lowStock.length > 0) {
      autoTable(doc, {
        startY: 95,
        head: [['Drug Name', 'Current Stock', 'Unit Price']],
        body: lowStock.map(item => [item.name, item.quantity.toString(), `NGN ${item.price?.toLocaleString()}`]),
        theme: 'striped',
        headStyles: { fillColor: [220, 38, 38] }
      });
    } else {
      doc.setFontSize(12);
      doc.text('No low stock alerts. Inventory is healthy.', 14, 100);
    }

    // Section 3: Staff Activity
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 115;
    doc.setFontSize(16);
    doc.text('3. Staff Activity (Last 30 Days)', 14, finalY);
    
    const staffSales: Record<string, { count: number, revenue: number }> = {};
    recentRecords.forEach(r => {
      const staff = r.staffName || 'Unknown';
      if (!staffSales[staff]) staffSales[staff] = { count: 0, revenue: 0 };
      staffSales[staff].count += 1;
      staffSales[staff].revenue += (r.totalAmount || 0);
    });

    const staffData = Object.entries(staffSales).map(([name, data]) => [
      name, 
      data.count.toString(), 
      `NGN ${data.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ]);

    if (staffData.length > 0) {
      autoTable(doc, {
        startY: finalY + 5,
        head: [['Staff Name', 'Transactions', 'Revenue Generated']],
        body: staffData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }
      });
    } else {
      doc.setFontSize(12);
      doc.text('No recent staff activity.', 14, finalY + 10);
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text('Generated by MedTrack Pro', 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`MedTrack_Report_${orgName.replace(/\s+/g, '_')}_${monthYear.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 text-sm font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-600" />
            Super Admin Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage platform tenants, businesses, and billing.</p>
        </div>
        <button
          onClick={() => setShowOrgModal(true)}
          className="bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Onboard New Pharmacy
        </button>
      </div>

      {/* Permanent Client Link Section */}
      <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
            🔗 Permanent Client Portal Link
          </h3>
          <p className="text-xs text-indigo-700 mt-1 max-w-2xl">
            This is your universal platform link. After registering a business above, you can simply send them this link via WhatsApp or Email. When they click it, they just need to sign up using the exact email address you registered them with to automatically access their new workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <code className="bg-white px-3 py-2 rounded-lg border border-indigo-100 text-xs text-indigo-600 truncate max-w-[200px] md:max-w-xs">
            {window.location.origin}
          </code>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.origin);
              alert('Universal link copied to clipboard!');
            }} 
            className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
          >
            Copy Link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 border-t-4 border-t-emerald-500 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">Platform Revenue</h3>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 tabular-nums">
            ₦{globalMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Aggregated tenant volume</p>
        </div>
        <div className="bg-white border border-slate-200 border-t-4 border-t-indigo-500 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800">Total Pharmacies</h3>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-600 tabular-nums">{globalMetrics.totalPharmacies}</p>
          <p className="text-[10px] text-slate-400 mt-1">Registered pharmacy tenants</p>
        </div>
        <div className="bg-white border border-slate-200 border-t-4 border-t-blue-500 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800">Total Users</h3>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-500/20 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 tabular-nums">{globalMetrics.totalUsers}</p>
          <p className="text-[10px] text-slate-400 mt-1">Active staff & practitioners</p>
        </div>
        <div className="bg-white border border-slate-200 border-t-4 border-t-purple-500 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-800">Prescriptions</h3>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 ring-1 ring-purple-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-600 tabular-nums">{globalMetrics.totalPrescriptions}</p>
          <p className="text-[10px] text-slate-400 mt-1">Dispensed clinical orders</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-800">Active Organizations (Tenants)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-semibold">Business Name</th>
                <th className="px-6 py-4 font-semibold">Tenant ID</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Staff</th>
                <th className="px-6 py-4 font-semibold">Revenue</th>
                <th className="px-6 py-4 font-semibold">Joined On</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No organizations on the platform yet. Click "Onboard New Pharmacy" to begin.
                  </td>
                </tr>
              ) : (
                organizations.map(org => {
                  const m = orgMetrics[org.id] || { totalRevenue: 0, staffCount: 0, prescriptions: 0 };
                  return (
                    <tr key={org.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{org.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">{org.id.split('-')[0]}...</code>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          org.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}>
                          {org.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {m.staffCount}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        ₦{m.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedOrgForView(org)}
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200 shadow-sm flex items-center gap-1.5"
                          >
                            God Mode Viewer
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setOrgToDelete(org);
                            }}
                            className="text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition-colors border border-rose-200 shadow-sm flex items-center gap-1.5"
                            title={`Delete ${org.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showOrgModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Onboard New Pharmacy
              </h3>
              <button onClick={() => setShowOrgModal(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>
            
            <form onSubmit={handleCreateOrganization} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Pharmacy Business Name</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="e.g., HealthPlus Pharmacy"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Primary Admin Email</label>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={e => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="admin@healthplus.com"
                />
                <p className="text-xs text-slate-500 mt-2">
                  This user will be granted the 'Admin' role for this business. They can then invite their own staff.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOrgModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  Create & Onboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Pharmacy Confirmation Modal */}
      {orgToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-rose-50/70">
              <h3 className="font-bold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Remove Pharmacy Organization
              </h3>
              <button 
                onClick={() => !isDeleting && setOrgToDelete(null)} 
                disabled={isDeleting}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none disabled:opacity-50"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-900 font-semibold">{orgToDelete.name}</strong> from MedTrack Pro?
              </p>

              <div className="bg-rose-50 border border-rose-100 rounded-lg p-3.5 text-xs text-rose-800 space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  Irreversible Action
                </p>
                <p className="leading-relaxed">
                  This will permanently delete this pharmacy tenant, revoke access for its assigned staff, and detach all records. Users from this business will no longer be able to access the system.
                </p>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-100 border border-red-200 text-red-700 text-xs rounded-lg">
                  {deleteError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setOrgToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => handleDeleteOrganization(orgToDelete)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Yes, Delete Pharmacy
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOrgForView && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-end z-50">
          <div className="bg-white h-full w-full max-w-2xl shadow-xl flex flex-col animate-in slide-in-from-right">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedOrgForView.name}</h2>
                <p className="text-sm text-slate-500">Super Admin Data Viewer (Read-Only)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadReport}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Monthly Report (PDF)
                </button>
                <button
                  onClick={() => {
                    setDeleteError(null);
                    setOrgToDelete(selectedOrgForView);
                  }}
                  className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                  title="Remove this pharmacy"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <button 
                  onClick={() => setSelectedOrgForView(null)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors ml-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Staff Section */}
              <section>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Staff Members
                </h3>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200">Name / Email</th>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {staffRoles.filter(s => s.organizationId === selectedOrgForView.id).map(staff => (
                        <tr key={staff.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{staff.name || 'Unknown'}</div>
                            <div className="text-xs text-slate-500">{staff.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                              {staff.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Inventory Section */}
              <section>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  Current Inventory
                </h3>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200">Drug Name</th>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200 text-right">Stock</th>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200 text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orgInventory.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-slate-500">No inventory found.</td>
                        </tr>
                      ) : (
                        orgInventory.map(item => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              <span className={item.quantity < 20 ? 'text-rose-600 font-bold' : ''}>
                                {item.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">₦{item.price?.toLocaleString()}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Recent Transactions Section */}
              <section>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  Recent Transactions
                </h3>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200">Date</th>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200">Items</th>
                        <th className="px-4 py-3 font-medium text-slate-500 border-b border-slate-200 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dispenseRecords
                        .filter(r => r.organizationId === selectedOrgForView.id)
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 10)
                        .map(record => (
                        <tr key={record.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">
                            {new Date(record.timestamp).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-slate-800">
                            {record.items?.length || 0} items
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">
                            ₦{record.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {dispenseRecords.filter(r => r.organizationId === selectedOrgForView.id).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-slate-500">No recent transactions.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
