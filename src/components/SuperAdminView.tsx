import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, Organization, DispenseRecord } from '../types';
import { db, collection, onSnapshot, addDoc, setDoc, doc } from '../db';
import { Building2, Users, Plus, Shield, TrendingUp, Activity } from 'lucide-react';

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

      // 3. Send email via backend API
      let inviteMessage = `Organization "${newOrgName}" created successfully! Admin invite sent to ${cleanEmail}.`;
      try {
        const res = await fetch('/api/send-invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            organizationName: newOrgName,
            appUrl: window.location.origin
          })
        });
        const data = await res.json();
        
        if (data.stub) {
          inviteMessage = `Organization "${newOrgName}" created successfully!\n\nNOTE: You have not configured SMTP email settings in your Environment Variables yet, so the email was NOT sent.\n\nPlease copy this login link and send it to the admin manually:\n\n${data.link}`;
        }
      } catch (emailErr) {
        console.error("Failed to send invite email", emailErr);
      }

      setNewOrgName('');
      setAdminEmail('');
      setShowOrgModal(false);
      alert(inviteMessage);
    } catch (err: any) {
      alert("Error creating organization: " + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-500">Platform Revenue</h3>
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">
            ₦{globalMetrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-500">Total Pharmacies</h3>
            <Building2 className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{globalMetrics.totalPharmacies}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-500">Total Users</h3>
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{globalMetrics.totalUsers}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-500">Prescriptions</h3>
            <Activity className="w-5 h-5 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-slate-800">{globalMetrics.totalPrescriptions}</p>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {organizations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 text-sm">
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
    </div>
  );
}
