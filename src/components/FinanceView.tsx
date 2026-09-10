import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, setDoc, deleteDoc } from '../firebase';
import { UserProfile, Drug, PurchaseRecord, DispenseRecord, OperatingExpense, ExpenseCategory } from '../types';
import { 
  DollarSign, TrendingUp, TrendingDown, Wallet, Receipt, 
  Plus, Trash2, Calendar, Filter, Download, Upload, 
  ArrowUpRight, ArrowDownRight, Tag, CreditCard, PieChart as PieChartIcon, 
  FileSpreadsheet, Zap, Fuel, Wrench, Briefcase, Building, Truck, ShoppingBag, 
  CheckCircle2, Sparkles, AlertCircle, Edit3, ArrowRight, ShieldCheck, Check, Package, RefreshCw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, 
  ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import ImportSalesModal from './ImportSalesModal';
import ImportExpensesModal from './ImportExpensesModal';

interface FinanceViewProps {
  profile: UserProfile;
  drugs: Drug[];
  purchases: PurchaseRecord[];
  dispenses: DispenseRecord[];
  expenses: OperatingExpense[];
  currencySymbol?: string;
}

export const EXPENSE_CATEGORIES: { key: ExpenseCategory; label: string; icon: any; color: string; bg: string }[] = [
  { key: 'salaries', label: 'Salaries & Staff Wages', icon: Briefcase, color: '#3b82f6', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'electricity', label: 'Electricity & Utilities', icon: Zap, color: '#eab308', bg: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { key: 'generator_fuel', label: 'Generator Fuel (Diesel/Petrol)', icon: Fuel, color: '#f97316', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'generator_maintenance', label: 'Generator & Plant Maintenance', icon: Wrench, color: '#ef4444', bg: 'bg-red-50 text-red-700 border-red-200' },
  { key: 'rent', label: 'Facility Rent & Rates', icon: Building, color: '#8b5cf6', bg: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'supplies', label: 'Office & Medical Supplies', icon: ShoppingBag, color: '#10b981', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'logistics', label: 'Logistics, Transport & Dispatch', icon: Truck, color: '#06b6d4', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { key: 'marketing', label: 'Admin & Marketing', icon: Tag, color: '#6366f1', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'other', label: 'Other Operating Expenses', icon: Receipt, color: '#64748b', bg: 'bg-slate-50 text-slate-700 border-slate-200' },
];

export default function FinanceView({ 
  profile, 
  drugs, 
  purchases, 
  dispenses, 
  expenses,
  currencySymbol = '₦'
}: FinanceViewProps) {
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | 'this_month' | 'last_month' | 'custom'>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // New Operating Expense Form State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('salaries');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseDate, setExpenseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<'cash' | 'transfer' | 'card' | 'cheque' | 'other'>('transfer');
  const [expenseReference, setExpenseReference] = useState('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Active Subtab inside Finance
  const [isImportSalesModalOpen, setIsImportSalesModalOpen] = useState(false);
  const [isImportExpensesModalOpen, setIsImportExpensesModalOpen] = useState(false);
  const [financeTab, setFinanceTab] = useState<'overview' | 'drug_pricing' | 'operating_costs' | 'sales_income' | 'drug_expenditure' | 'pnl_statement'>('overview');

  // Drug Pricing & Selling Rates Manager State (Dropdown & Live Rate Controller)
  const [selectedPricingDrugId, setSelectedPricingDrugId] = useState('');
  const [pricingSellingPrice, setPricingSellingPrice] = useState<number | ''>('');
  const [pricingCostPrice, setPricingCostPrice] = useState<number | ''>('');
  const [pricingSearch, setPricingSearch] = useState('');
  const [pricingCategoryFilter, setPricingCategoryFilter] = useState<'all' | 'medication' | 'consumable'>('all');
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [justSavedPrice, setJustSavedPrice] = useState(false);
  const [priceSuccessBanner, setPriceSuccessBanner] = useState<string | null>(null);

  // Search & Filter within lists
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');
  const [salesSearch, setSalesSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');

  // Handle drug selection in the Pricing Dropdown Menu
  const handleSelectDrugForPricing = (drugId: string) => {
    setSelectedPricingDrugId(drugId);
    setPriceSuccessBanner(null);
    setJustSavedPrice(false);
    if (!drugId) {
      setPricingSellingPrice('');
      setPricingCostPrice('');
      return;
    }
    const drug = drugs.find(d => d.id === drugId);
    if (drug) {
      setPricingSellingPrice(drug.sellingPrice !== undefined && drug.sellingPrice !== null ? drug.sellingPrice : '');
      setPricingCostPrice(drug.costPrice !== undefined && drug.costPrice !== null ? drug.costPrice : '');
    }
  };

  // Save/Update current drug price in Firestore (immediately propagated to Branch)
  const handleSaveDrugPrice = async (e?: React.FormEvent, customDrugId?: string, customSelling?: number, customCost?: number) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetDrugId = customDrugId || selectedPricingDrugId;
    if (!targetDrugId) {
      alert('Please select a registered drug from the dropdown menu first.');
      return;
    }
    const drug = drugs.find(d => d.id === targetDrugId);
    if (!drug) {
      alert('Drug details not found. Please refresh or select a drug.');
      return;
    }

    const finalSellingPrice = customSelling !== undefined 
      ? (isNaN(customSelling) ? null : customSelling)
      : (typeof pricingSellingPrice === 'number' && !isNaN(pricingSellingPrice) ? pricingSellingPrice : (pricingSellingPrice === '' ? null : Number(pricingSellingPrice) || null));
    
    const finalCostPrice = customCost !== undefined 
      ? (isNaN(customCost) ? null : customCost)
      : (typeof pricingCostPrice === 'number' && !isNaN(pricingCostPrice) ? pricingCostPrice : (pricingCostPrice === '' ? null : Number(pricingCostPrice) || null));

    try {
      setIsUpdatingPrice(true);
      const updateData: Record<string, any> = {
        sellingPrice: finalSellingPrice,
        costPrice: finalCostPrice,
        lastPriceUpdatedAt: Date.now(),
        lastPriceUpdatedBy: profile?.name || profile?.email || 'Admin'
      };

      await setDoc(doc(db, 'drugs', targetDrugId), updateData, { merge: true });

      const formattedPrice = finalSellingPrice !== null ? `${currencySymbol}${finalSellingPrice.toLocaleString()}` : 'Not Set';
      setJustSavedPrice(true);
      setPriceSuccessBanner(`Current selling price for "${drug.name}" saved & broadcasted at ${formattedPrice}. Branch reflects this rate immediately.`);
      
      setTimeout(() => {
        setJustSavedPrice(false);
      }, 3500);

      setTimeout(() => {
        setPriceSuccessBanner(null);
      }, 7000);
    } catch (err: any) {
      console.error('Error updating drug price:', err);
      alert('Failed to update drug price in database: ' + (err?.message || 'Check network connection'));
    } finally {
      setIsUpdatingPrice(false);
    }
  };

  // Calculate Date Boundaries
  const filterInterval = useMemo(() => {
    const now = new Date();
    if (dateFilter === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      return { start, end };
    }
    if (dateFilter === '7days') {
      return { start: subDays(now, 7), end: now };
    }
    if (dateFilter === 'this_month') {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    if (dateFilter === 'last_month') {
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { start: startOfMonth(prevMonthDate), end: endOfMonth(prevMonthDate) };
    }
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate + 'T00:00:00');
      const end = new Date(customEndDate + 'T23:59:59');
      return { start, end };
    }
    return null; // 'all'
  }, [dateFilter, customStartDate, customEndDate]);

  // Filtered Datasets based on Date Filter
  const filteredDispenses = useMemo(() => {
    if (!filterInterval) return dispenses;
    return dispenses.filter(d => {
      const recordDate = new Date(d.createdAt);
      return recordDate >= filterInterval.start && recordDate <= filterInterval.end;
    });
  }, [dispenses, filterInterval]);

  const filteredPurchases = useMemo(() => {
    if (!filterInterval) return purchases;
    return purchases.filter(p => {
      const recordDate = new Date(p.createdAt);
      return recordDate >= filterInterval.start && recordDate <= filterInterval.end;
    });
  }, [purchases, filterInterval]);

  const filteredExpenses = useMemo(() => {
    if (!filterInterval) return expenses;
    return expenses.filter(e => {
      const recordDate = e.expenseDate ? parseISO(e.expenseDate) : new Date(e.createdAt);
      return recordDate >= filterInterval.start && recordDate <= filterInterval.end;
    });
  }, [expenses, filterInterval]);

  // Financial Metrics Calculation
  // 1. Sales Income
  const totalSalesIncome = useMemo(() => {
    return filteredDispenses.reduce((acc, d) => {
      if (d.totalAmount !== undefined && d.totalAmount > 0) {
        return acc + d.totalAmount;
      }
      if (d.unitPrice !== undefined && d.unitPrice > 0) {
        return acc + (d.quantityDispensed * d.unitPrice);
      }
      // Fallback: Check if drug master record has sellingPrice
      const drug = drugs.find(item => item.id === d.drugId);
      const unitPrice = drug?.sellingPrice || 0;
      return acc + (d.quantityDispensed * unitPrice);
    }, 0);
  }, [filteredDispenses, drugs]);

  // 2. Drug Purchase Expenditure (Inventory COGS / Purchases)
  const totalDrugExpenditure = useMemo(() => {
    return filteredPurchases.reduce((acc, p) => {
      if (p.totalCost !== undefined && p.totalCost > 0) {
        return acc + p.totalCost;
      }
      if (p.unitCostPrice !== undefined && p.unitCostPrice > 0) {
        return acc + (p.quantityPurchased * p.unitCostPrice);
      }
      // Fallback: Check drug master record cost price
      const drug = drugs.find(item => item.id === p.drugId);
      const unitCost = drug?.costPrice || 0;
      return acc + (p.quantityPurchased * unitCost);
    }, 0);
  }, [filteredPurchases, drugs]);

  // 3. Operating Expenditure (OPEX)
  const totalOperatingExpenditure = useMemo(() => {
    return filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
  }, [filteredExpenses]);

  // Category breakdown for Operating Expenses
  const opexByCategory = useMemo(() => {
    const map: { [key in ExpenseCategory]?: number } = {};
    filteredExpenses.forEach(e => {
      map[e.category] = (map[e.category] || 0) + (e.amount || 0);
    });
    return map;
  }, [filteredExpenses]);

  // Specific common operating expenses for quick badges
  const salariesCost = opexByCategory['salaries'] || 0;
  const fuelCost = opexByCategory['generator_fuel'] || 0;
  const maintenanceCost = opexByCategory['generator_maintenance'] || 0;
  const electricityCost = opexByCategory['electricity'] || 0;

  // 4. Gross Margin & Net Profit
  const totalCompanyExpenditure = totalDrugExpenditure + totalOperatingExpenditure;
  const grossProfit = totalSalesIncome - totalDrugExpenditure;
  const netProfit = totalSalesIncome - totalCompanyExpenditure;
  const profitMarginPercent = totalSalesIncome > 0 ? ((netProfit / totalSalesIncome) * 100).toFixed(1) : '0.0';

  // Handler to Log New Operating Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0 || !expenseDescription.trim()) {
      alert('Please enter a valid expense amount and description.');
      return;
    }

    try {
      setIsSubmittingExpense(true);
      const expensePayload: any = {
        adminId: profile.id,
        adminName: profile.name,
        category: expenseCategory,
        amount: Number(expenseAmount),
        expenseDate: expenseDate || format(new Date(), 'yyyy-MM-dd'),
        description: expenseDescription.trim(),
        paymentMethod: expensePaymentMethod,
        createdAt: Date.now()
      };
      if (expenseCategory === 'other' && customCategoryName.trim()) {
        expensePayload.customCategory = customCategoryName.trim();
      }
      if (expenseReference.trim()) {
        expensePayload.referenceNumber = expenseReference.trim();
      }

      await addDoc(collection(db, 'operating_expenses'), expensePayload);

      // Reset Form
      setExpenseAmount('');
      setExpenseDescription('');
      setCustomCategoryName('');
      setExpenseReference('');
      setShowExpenseModal(false);
      alert('Operating expense recorded successfully.');
    } catch (err) {
      console.error('Error recording expense:', err);
      alert('Failed to record operating expense. Please check your network and permissions.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string, description: string) => {
    if (!window.confirm(`Are you sure you want to delete the expense "${description}"?`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'operating_expenses', id));
    } catch (err) {
      console.error('Error deleting expense:', err);
      alert('Failed to delete expense.');
    }
  };

  // Monthly / Period Trends Data for Chart
  const monthlyTrendsData = useMemo(() => {
    // Generate monthly buckets for the last 6 months
    const buckets: { [key: string]: { name: string; income: number; drugCost: number; opex: number; totalCost: number; netProfit: number } } = {};
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = format(monthDate, 'yyyy-MM');
      buckets[key] = {
        name: format(monthDate, 'MMM yyyy'),
        income: 0,
        drugCost: 0,
        opex: 0,
        totalCost: 0,
        netProfit: 0
      };
    }

    // Populate Dispenses (Income)
    dispenses.forEach(d => {
      const key = format(new Date(d.createdAt), 'yyyy-MM');
      if (buckets[key]) {
        let amount = d.totalAmount || (d.unitPrice ? d.quantityDispensed * d.unitPrice : 0);
        if (!amount) {
          const drug = drugs.find(item => item.id === d.drugId);
          amount = d.quantityDispensed * (drug?.sellingPrice || 0);
        }
        buckets[key].income += amount;
      }
    });

    // Populate Purchases (Drug Cost)
    purchases.forEach(p => {
      const key = format(new Date(p.createdAt), 'yyyy-MM');
      if (buckets[key]) {
        let cost = p.totalCost || (p.unitCostPrice ? p.quantityPurchased * p.unitCostPrice : 0);
        if (!cost) {
          const drug = drugs.find(item => item.id === p.drugId);
          cost = p.quantityPurchased * (drug?.costPrice || 0);
        }
        buckets[key].drugCost += cost;
      }
    });

    // Populate Operating Expenses
    expenses.forEach(e => {
      const d = e.expenseDate ? parseISO(e.expenseDate) : new Date(e.createdAt);
      const key = format(d, 'yyyy-MM');
      if (buckets[key]) {
        buckets[key].opex += e.amount || 0;
      }
    });

    // Compute totals
    return Object.values(buckets).map(b => {
      const totalCost = b.drugCost + b.opex;
      return {
        ...b,
        totalCost,
        netProfit: b.income - totalCost
      };
    });
  }, [dispenses, purchases, expenses, drugs]);

  // Operating Expense Category Pie Data
  const opexPieData = useMemo(() => {
    return EXPENSE_CATEGORIES.map(cat => {
      const val = opexByCategory[cat.key] || 0;
      return {
        name: cat.label,
        value: val,
        color: cat.color
      };
    }).filter(item => item.value > 0);
  }, [opexByCategory]);

  const formatCurrency = (val: number) => {
    return `${currencySymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCategoryMeta = (catKey: string) => {
    return EXPENSE_CATEGORIES.find(c => c.key === catKey) || {
      key: 'other',
      label: catKey,
      icon: Receipt,
      color: '#64748b',
      bg: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Header & Date Range Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-600" />
            Company Financial & Expense Center
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of sales revenue, drug cost of goods, and company operating expenses.
          </p>
        </div>

        {/* Action Buttons & Date Filter */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 ml-1.5" />
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-700 py-1 px-2 focus:outline-none cursor-pointer"
            >
              <option value="this_month">This Month</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="last_month">Last Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateFilter === 'custom' && (
            <div className="flex items-center gap-1.5 text-xs bg-slate-50 p-1 rounded-lg border border-slate-200">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="p-1 border border-slate-300 rounded text-xs text-slate-700 bg-white"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="p-1 border border-slate-300 rounded text-xs text-slate-700 bg-white"
              />
            </div>
          )}

          <button
            onClick={() => setShowExpenseModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Record Operating Expense
          </button>
        </div>
      </div>

      {/* Primary Financial Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Income */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Income from Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{formatCurrency(totalSalesIncome)}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-semibold text-emerald-600">{filteredDispenses.length}</span> sales transactions
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>Prescription & OTC Sales</span>
            <span className="text-emerald-600 font-bold">Revenue</span>
          </div>
        </div>

        {/* Drug Cost Expenditure */}
        <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Drug Cost (Purchases)</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{formatCurrency(totalDrugExpenditure)}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-semibold text-indigo-600">{filteredPurchases.length}</span> purchase batches
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>Inventory Cost of Goods</span>
            <span className="text-indigo-600 font-bold">Stock Intake</span>
          </div>
        </div>

        {/* Operating Costs (Salaries, Fuel, Maintenance, Utilities) */}
        <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Operating Costs (OPEX)</span>
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{formatCurrency(totalOperatingExpenditure)}</div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span className="font-semibold text-orange-600">{filteredExpenses.length}</span> logged expense items
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>Salaries, Fuel, Utilities & Repairs</span>
            <span className="text-orange-600 font-bold">Running Cost</span>
          </div>
        </div>

        {/* Net Profit / Balance */}
        <div className={`bg-white p-4 rounded-xl border shadow-sm relative overflow-hidden flex flex-col justify-between ${
          netProfit >= 0 ? 'border-indigo-300' : 'border-red-300'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${
              netProfit >= 0 ? 'text-indigo-700' : 'text-red-700'
            }`}>
              Net Business Balance
            </span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              netProfit >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-red-100 text-red-700'
            }`}>
              {netProfit >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </div>
          </div>
          <div className="my-2">
            <div className={`text-2xl font-black ${netProfit >= 0 ? 'text-indigo-950' : 'text-red-600'}`}>
              {formatCurrency(netProfit)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                netProfit >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}>
                {netProfit >= 0 ? 'NET PROFIT' : 'NET DEFICIT'}
              </span>
              <span>Margin: {profitMarginPercent}%</span>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
            <span>Income minus Total Costs</span>
            <span className="font-bold text-slate-700">Gross: {formatCurrency(grossProfit)}</span>
          </div>
        </div>
      </div>

      {/* Operating Expense Specific Highlights (Salaries, Fuel, Maintenance, Electricity) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <Briefcase className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase truncate">Salaries & Wages</div>
            <div className="text-sm font-bold text-slate-900 truncate">{formatCurrency(salariesCost)}</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
            <Fuel className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase truncate">Generator Fuel</div>
            <div className="text-sm font-bold text-slate-900 truncate">{formatCurrency(fuelCost)}</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase truncate">Generator Maintenance</div>
            <div className="text-sm font-bold text-slate-900 truncate">{formatCurrency(maintenanceCost)}</div>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-100 text-yellow-700 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-slate-500 uppercase truncate">Electricity & Utilities</div>
            <div className="text-sm font-bold text-slate-900 truncate">{formatCurrency(electricityCost)}</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 pt-2 rounded-t-xl overflow-x-auto gap-1">
        <button
          onClick={() => setFinanceTab('overview')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors border-b-2 ${
            financeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <PieChartIcon className="w-3.5 h-3.5" />
          Financial Overview & Analytics
        </button>

        <button
          onClick={() => setFinanceTab('drug_pricing')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors border-b-2 ${
            financeTab === 'drug_pricing'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Tag className="w-3.5 h-3.5" />
          Drug Pricing & Selling Rates ({drugs.length})
        </button>

        <button
          onClick={() => setFinanceTab('operating_costs')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors border-b-2 ${
            financeTab === 'operating_costs'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Operating Expenses ({filteredExpenses.length})
        </button>

        <button
          onClick={() => setFinanceTab('sales_income')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors border-b-2 ${
            financeTab === 'sales_income'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Sales & Income Log ({filteredDispenses.length})
        </button>

        <button
          onClick={() => setFinanceTab('drug_expenditure')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors border-b-2 ${
            financeTab === 'drug_expenditure'
              ? 'border-blue-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Drug Purchase Costs ({filteredPurchases.length})
        </button>

        <button
          onClick={() => setFinanceTab('pnl_statement')}
          className={`px-4 py-2.5 font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-colors border-b-2 ${
            financeTab === 'pnl_statement'
              ? 'border-slate-800 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Income & Expense Statement
        </button>
      </div>

      {/* TAB 1: Financial Overview & Visual Analytics */}
      {financeTab === 'overview' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly Trend Bar/Area Chart */}
            <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    6-Month Financial Performance (Revenue vs Total Cost)
                  </h3>
                  <p className="text-[11px] text-slate-400">Comparing income generated with all inventory and operating expenditures</p>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#64748b' }} 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(val) => `${currencySymbol}${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                    />
                    <RechartsTooltip 
                      formatter={(value: any) => [`${currencySymbol}${Number(value).toLocaleString()}`, '']}
                      contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="income" name="Sales Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="drugCost" name="Drug Inventory Cost" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="opex" name="Operating Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Operating Expense Breakdown Pie */}
            <div className="lg:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div className="mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Operating Cost Distribution
                </h3>
                <p className="text-[11px] text-slate-400">Expense split across operational channels</p>
              </div>

              {opexPieData.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 text-xs">
                  <Receipt className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
                  No operating expenses logged for this period. Click "Record Operating Expense" to get started.
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={opexPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={3}
                        >
                          {opexPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: any) => [`${currencySymbol}${Number(value).toLocaleString()}`, '']}
                          contentStyle={{ fontSize: '11px', borderRadius: '6px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto pr-1">
                    {opexPieData.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1 border-b border-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-600 text-[11px] truncate max-w-[140px]">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-800 text-[11px]">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Summary Table for Recent Operations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent Operating Expenses */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-orange-600" />
                  Recent Operating Expenses
                </h4>
                <button
                  onClick={() => setFinanceTab('operating_costs')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="space-y-2 flex-1">
                {filteredExpenses.slice(0, 5).map(e => {
                  const meta = getCategoryMeta(e.category);
                  const Icon = meta.icon;
                  return (
                    <div key={e.id} className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-xs flex justify-between items-center transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`p-1.5 rounded-md ${meta.bg} border shrink-0`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">{e.description}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{meta.label}</span>
                            <span>&bull;</span>
                            <span>{e.expenseDate || format(new Date(e.createdAt), 'MMM d, yyyy')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="font-extrabold text-orange-700 text-right whitespace-nowrap pl-2">
                        -{formatCurrency(e.amount)}
                      </div>
                    </div>
                  );
                })}
                {filteredExpenses.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No operating expenses logged in this date range.
                  </div>
                )}
              </div>
            </div>

            {/* Recent Sales Income */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  Recent Drug Sales Revenue
                </h4>
                <button
                  onClick={() => setFinanceTab('sales_income')}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                >
                  View All &rarr;
                </button>
              </div>

              <div className="space-y-2 flex-1">
                {filteredDispenses.slice(0, 5).map(d => {
                  const drug = drugs.find(item => item.id === d.drugId);
                  const price = d.unitPrice || drug?.sellingPrice || 0;
                  const total = d.totalAmount || (price * d.quantityDispensed);
                  return (
                    <div key={d.id} className="p-2.5 bg-emerald-50/40 hover:bg-emerald-50 rounded-lg border border-emerald-100 text-xs flex justify-between items-center transition-colors">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 truncate">
                          {d.drugName} <span className="font-normal text-slate-500">({d.quantityDispensed} {drug?.unit || 'units'})</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>Patient: {d.patientName || 'Walk-in / Prescription'}</span>
                          <span>&bull;</span>
                          <span>{format(new Date(d.createdAt), 'MMM d, h:mm a')}</span>
                        </div>
                      </div>
                      <div className="font-extrabold text-emerald-700 text-right whitespace-nowrap pl-2">
                        +{formatCurrency(total)}
                      </div>
                    </div>
                  );
                })}
                {filteredDispenses.length === 0 && (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    No sales recorded in this date range.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Drug Price Management Banner in Overview */}
          <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-50/40 via-white to-emerald-50/30">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm shrink-0">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  Drug Pricing & Selling Rate Center
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">Live Sync</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set and update current prices of registered drugs from time to time. Current prices are instantly transmitted to the Branch view for billing.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setFinanceTab('drug_pricing')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <Tag className="w-3.5 h-3.5" />
                Manage Drug Prices & Margins ({drugs.length}) &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: Drug Pricing & Selling Rates Manager */}
      {financeTab === 'drug_pricing' && (
        <div className="flex flex-col gap-5">
          {/* Status / Success Banner */}
          {priceSuccessBanner && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-3 shadow-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div className="flex-1 font-medium">{priceSuccessBanner}</div>
              <button 
                onClick={() => setPriceSuccessBanner(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold text-xs px-2 py-1 rounded"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Top Interactive Pricing Control Station (Dropdown Menu & Margin Analyzer) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold tracking-wide uppercase">
                    Drug Pricing & Selling Rate Controller
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Select any registered drug from the dropdown menu to set or adjust its current selling price. Changes take effect in the Branch automatically.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs bg-indigo-500/20 px-3 py-1.5 rounded-lg border border-indigo-400/30 text-indigo-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                <span>Live Real-Time Branch Sync</span>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Dropdown Menu to Select Registered Drug */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-600 tracking-wider">
                  Select Registered Drug / Item from Dropdown Menu
                </label>
                <div className="relative">
                  <select
                    value={selectedPricingDrugId}
                    onChange={e => handleSelectDrugForPricing(e.target.value)}
                    className="w-full p-3 bg-slate-50 border-2 border-indigo-200 hover:border-indigo-400 focus:border-indigo-600 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="">-- Click here to select a registered drug --</option>
                    {drugs.map(d => {
                      const drugPurchases = purchases.filter(p => p.drugId === d.id);
                      const latestP = drugPurchases.sort((a, b) => b.createdAt - a.createdAt)[0];
                      const purchaseRef = latestP?.unitCostPrice ? ` | Latest Supplier Cost: ${formatCurrency(latestP.unitCostPrice)}` : (d.costPrice ? ` | Cost: ${formatCurrency(d.costPrice)}` : '');
                      const priceTag = d.sellingPrice ? ` | Current Price: ${formatCurrency(d.sellingPrice)}` : ' | [PRICE NOT SET]';
                      return (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.category || 'medication'}){priceTag}{purchaseRef} &bull; (Stock: Store {d.branchStock?.['central']}, Disp {((Object.values(d.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) - (d.branchStock?.['central'] || 0))})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Drug Pricing Form & Live Margin Calculation when a drug is selected */}
              {selectedPricingDrugId ? (() => {
                const drug = drugs.find(d => d.id === selectedPricingDrugId);
                if (!drug) return null;

                const drugPurchases = purchases.filter(p => p.drugId === drug.id).sort((a, b) => b.createdAt - a.createdAt);
                const latestPurchase = drugPurchases[0];
                const latestUnitCost = latestPurchase?.unitCostPrice || (latestPurchase?.totalCost && latestPurchase?.quantityPurchased ? latestPurchase.totalCost / latestPurchase.quantityPurchased : (drug.costPrice || 0));
                
                const currentSellingVal = typeof pricingSellingPrice === 'number' ? pricingSellingPrice : 0;
                const referenceCostVal = typeof pricingCostPrice === 'number' ? pricingCostPrice : (latestUnitCost || 0);
                
                const unitMargin = currentSellingVal > 0 ? (currentSellingVal - referenceCostVal) : 0;
                const marginPercent = currentSellingVal > 0 ? ((unitMargin / currentSellingVal) * 100).toFixed(1) : '0.0';
                const markupPercent = referenceCostVal > 0 && currentSellingVal > 0 ? (((currentSellingVal - referenceCostVal) / referenceCostVal) * 100).toFixed(1) : '0.0';

                let healthStatusColor = 'bg-slate-100 text-slate-700 border-slate-200';
                let healthStatusText = 'Price Not Set';
                if (currentSellingVal > 0) {
                  if (unitMargin < 0) {
                    healthStatusColor = 'bg-red-100 text-red-800 border-red-200';
                    healthStatusText = 'Loss Warning (Selling Below Cost)';
                  } else if (Number(marginPercent) < 15) {
                    healthStatusColor = 'bg-amber-100 text-amber-800 border-amber-200';
                    healthStatusText = 'Low Margin (< 15%)';
                  } else if (Number(marginPercent) <= 40) {
                    healthStatusColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    healthStatusText = 'Healthy Margin (15% - 40%)';
                  } else {
                    healthStatusColor = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                    healthStatusText = 'High Margin (> 40%)';
                  }
                }

                return (
                  <form onSubmit={handleSaveDrugPrice} className="space-y-6 pt-2 border-t border-slate-200">
                    {/* Selected Drug Summary Card */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-sm">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-slate-900">{drug.name}</h4>
                            <span className="text-[10px] px-2 py-0.5 font-bold uppercase rounded-full bg-slate-200 text-slate-700">
                              {drug.category || 'medication'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 font-bold rounded-full bg-indigo-100 text-indigo-700">
                              Unit: {drug.unit || 'units'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Total Available Stock: <strong className="text-slate-800">{(drug.branchStock?.['central'] || 0) + (((Object.values(drug.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) - (drug.branchStock?.['central'] || 0)) || 0)} {drug.unit || 'units'}</strong> (Store: {drug.branchStock?.['central'] || 0}, Branch: {((Object.values(drug.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) - (drug.branchStock?.['central'] || 0)) || 0})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${healthStatusColor}`}>
                          <ShieldCheck className="w-4 h-4" />
                          <span>{healthStatusText}</span>
                        </div>
                      </div>
                    </div>

                    {/* Inputs & Analytics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Current Selling Price Input */}
                      <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-1.5">
                        <label className="block text-[11px] font-bold uppercase text-emerald-800 tracking-wider">
                          Current Selling Price ({currencySymbol}) *
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-700">{currencySymbol}</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            placeholder="e.g. 500"
                            value={pricingSellingPrice}
                            onChange={e => setPricingSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full pl-7 pr-3 py-2 bg-white border border-emerald-300 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <p className="text-[10px] text-emerald-700 font-medium">
                          Active rate billed to patients at Branch.
                        </p>
                      </div>

                      {/* Reference Cost Price Input */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5">
                        <label className="block text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                          Reference Cost Price ({currencySymbol})
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">{currencySymbol}</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="e.g. 350"
                            value={pricingCostPrice}
                            onChange={e => setPricingCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                            className="w-full pl-7 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {latestUnitCost > 0 ? `Latest Supplier Cost: ${formatCurrency(latestUnitCost)}` : 'Standard reference unit purchase cost'}
                        </p>
                      </div>

                      {/* Margin Per Unit */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                          Unit Gross Profit
                        </div>
                        <div className="text-lg font-extrabold text-slate-800 my-1">
                          {formatCurrency(unitMargin)}
                          <span className="text-xs font-normal text-slate-500 ml-1">/ {drug.unit || 'unit'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Markup over cost: <strong className="text-slate-700">{markupPercent}%</strong>
                        </div>
                      </div>

                      {/* Profit Margin Percentage */}
                      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                        <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                          Gross Margin %
                        </div>
                        <div className="text-lg font-extrabold text-indigo-600 my-1">
                          {marginPercent}%
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Profit share of selling price
                        </div>
                      </div>
                    </div>

                    {/* Purchase History Reference for this Drug */}
                    {drugPurchases.length > 0 && (
                      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />
                            Recent Supplier Purchase History for {drug.name} ({drugPurchases.length} batches)
                          </h5>
                          <span className="text-[11px] text-slate-500">
                            Use actual supplier invoices to guide pricing decisions
                          </span>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-200/70 text-slate-600 uppercase font-bold text-[10px]">
                              <tr>
                                <th className="p-2 rounded-l">Purchase Date</th>
                                <th className="p-2">Supplier / Vendor</th>
                                <th className="p-2">Invoice / Ref #</th>
                                <th className="p-2 text-right">Quantity</th>
                                <th className="p-2 text-right">Unit Cost Price</th>
                                <th className="p-2 text-right rounded-r">Total Batch Cost</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {drugPurchases.slice(0, 4).map(p => {
                                const unitPrice = p.unitCostPrice || (p.totalCost && p.quantityPurchased ? p.totalCost / p.quantityPurchased : 0);
                                return (
                                  <tr key={p.id} className="hover:bg-slate-50">
                                    <td className="p-2 font-medium text-slate-700">
                                      {format(new Date(p.createdAt), 'MMM d, yyyy')}
                                    </td>
                                    <td className="p-2 text-slate-600">{p.supplier || 'Direct Purchase'}</td>
                                    <td className="p-2 font-mono text-[11px] text-slate-500">{p.invoiceNumber || '-'}</td>
                                    <td className="p-2 text-right font-bold text-slate-800">{p.quantityPurchased}</td>
                                    <td className="p-2 text-right font-extrabold text-indigo-700">{formatCurrency(unitPrice)}</td>
                                    <td className="p-2 text-right font-bold text-slate-700">{formatCurrency(p.totalCost || (unitPrice * p.quantityPurchased))}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-200">
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span>The branch station will immediately update and display the new selling price.</span>
                      </div>

                      <button
                        type="submit"
                        onClick={(e) => handleSaveDrugPrice(e)}
                        disabled={isUpdatingPrice}
                        className={`px-6 py-2.5 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${
                          justSavedPrice
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-slate-900 hover:bg-slate-800 text-white'
                        }`}
                      >
                        {isUpdatingPrice ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-300" />
                            <span>Updating & Broadcasting...</span>
                          </>
                        ) : justSavedPrice ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-white" />
                            <span>Price Saved & Broadcasted to Branch!</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Save & Broadcast Current Price to Branch</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                );
              })() : (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                  <Tag className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-slate-700">Please choose a drug from the dropdown menu above</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    You can set current selling prices and reference cost prices from time to time to monitor business profitability.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Master Drug Pricing & Profitability Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  Master Drug Pricing & Selling Rates Catalog ({drugs.length} Items)
                </h3>
                <p className="text-[11px] text-slate-500">Live directory of all registered drugs, active branch rates, cost benchmarks, and margins</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search drug name..."
                  value={pricingSearch}
                  onChange={e => setPricingSearch(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400 w-full sm:w-48"
                />
                <select
                  value={pricingCategoryFilter}
                  onChange={e => setPricingCategoryFilter(e.target.value as any)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  <option value="medication">Medication</option>
                  <option value="consumable">Consumables</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Drug / Item Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Available Stock</th>
                    <th className="p-3 text-right">Latest Purchase Cost</th>
                    <th className="p-3 text-right">Ref. Cost Price</th>
                    <th className="p-3 text-right text-emerald-800">Current Selling Price (Branch)</th>
                    <th className="p-3 text-right">Gross Margin / Unit</th>
                    <th className="p-3 text-center">Margin %</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {drugs
                    .filter(d => {
                      const matchesSearch = d.name.toLowerCase().includes(pricingSearch.toLowerCase());
                      const matchesCat = pricingCategoryFilter === 'all' || d.category === pricingCategoryFilter;
                      return matchesSearch && matchesCat;
                    })
                    .map(d => {
                      const drugPurchases = purchases.filter(p => p.drugId === d.id).sort((a, b) => b.createdAt - a.createdAt);
                      const latestP = drugPurchases[0];
                      const latestUnitCost = latestP?.unitCostPrice || (latestP?.totalCost && latestP?.quantityPurchased ? latestP.totalCost / latestP.quantityPurchased : (d.costPrice || 0));
                      
                      const sellingPrice = d.sellingPrice || 0;
                      const refCost = d.costPrice !== undefined && d.costPrice !== null ? d.costPrice : latestUnitCost;
                      const marginAmount = sellingPrice > 0 ? (sellingPrice - refCost) : 0;
                      const marginPercent = sellingPrice > 0 ? ((marginAmount / sellingPrice) * 100).toFixed(1) : '0.0';

                      const isSelected = selectedPricingDrugId === d.id;

                      return (
                        <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/60' : ''}`}>
                          <td className="p-3 font-bold text-slate-900">
                            {d.name}
                            <span className="block text-[10px] font-normal text-slate-400">Unit: {d.unit || 'units'}</span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              d.category === 'consumable' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {d.category || 'medication'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-bold text-slate-800">{(d.branchStock?.['central'] || 0) + (((Object.values(d.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) - (d.branchStock?.['central'] || 0)) || 0)}</span>
                            <span className="block text-[10px] text-slate-400">Store: {d.branchStock?.['central'] || 0} | Disp: {((Object.values(d.branchStock || {}) as number[]).reduce<number>((a, b) => a + (b || 0), 0) - (d.branchStock?.['central'] || 0)) || 0}</span>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-600">
                            {latestUnitCost > 0 ? formatCurrency(latestUnitCost) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="p-3 text-right font-medium text-slate-600">
                            {d.costPrice !== undefined && d.costPrice !== null ? formatCurrency(d.costPrice) : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="p-3 text-right font-extrabold text-emerald-700 bg-emerald-50/30">
                            {d.sellingPrice ? (
                              formatCurrency(d.sellingPrice)
                            ) : (
                              <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded text-[10px]">Unpriced</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            {d.sellingPrice ? (
                              <span className={marginAmount < 0 ? 'text-red-600' : 'text-slate-800'}>
                                {formatCurrency(marginAmount)}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {d.sellingPrice ? (
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                Number(marginPercent) < 0 
                                  ? 'bg-red-100 text-red-700' 
                                  : Number(marginPercent) < 15 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {marginPercent}%
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => {
                                handleSelectDrugForPricing(d.id);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                              }`}
                            >
                              {isSelected ? 'Selected' : 'Set Price'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Operating Expenses Ledger */}
      {financeTab === 'operating_costs' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600" />
                Operating Expenses Ledger (Salaries, Fuel, Maintenance, Utilities)
              </h3>
              <p className="text-[11px] text-slate-500">Track and manage non-inventory operational expenditures</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setIsImportExpensesModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-semibold flex items-center transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import CSV
              </button>
              <input
                type="text"
                placeholder="Search expense description..."
                value={expenseSearch}
                onChange={e => setExpenseSearch(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400 w-full sm:w-48"
              />
              <select
                value={expenseCategoryFilter}
                onChange={e => setExpenseCategoryFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400"
              >
                <option value="all">All Categories</option>
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={() => setShowExpenseModal(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Expense
              </button>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description / Details</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Logged By</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredExpenses
                  .filter(e => {
                    const matchesSearch = e.description.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                      (e.referenceNumber && e.referenceNumber.toLowerCase().includes(expenseSearch.toLowerCase())) ||
                      (e.adminName && e.adminName.toLowerCase().includes(expenseSearch.toLowerCase()));
                    const matchesCategory = expenseCategoryFilter === 'all' || e.category === expenseCategoryFilter;
                    return matchesSearch && matchesCategory;
                  })
                  .map(e => {
                    const meta = getCategoryMeta(e.category);
                    const Icon = meta.icon;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600">
                          {e.expenseDate || format(new Date(e.createdAt), 'yyyy-MM-dd')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border ${meta.bg}`}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {e.description}
                          {e.referenceNumber && (
                            <span className="block text-[10px] text-slate-400 font-normal">Ref: #{e.referenceNumber}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize text-slate-600">
                          {e.paymentMethod || 'Transfer'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {e.adminName || 'Admin'}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-orange-700 whitespace-nowrap text-sm">
                          {formatCurrency(e.amount)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteExpense(e.id, e.description)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Delete Expense"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No operating expenses recorded for this period. Click "Add Expense" to log your first expenditure.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Total Operating Costs for Selected Period:</span>
            <span className="text-base font-black text-orange-700">{formatCurrency(totalOperatingExpenditure)}</span>
          </div>
        </div>
      )}

      {/* TAB 3: Sales & Income Log */}
      {financeTab === 'sales_income' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Sales & Revenue Ledger (Dispensed Medication & Consumables)
              </h3>
              <p className="text-[11px] text-slate-500">Every sales transaction recorded through the branch and prescription fulfillment</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setIsImportSalesModalOpen(true)}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded text-xs font-semibold flex items-center transition-colors shadow-sm"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import CSV
              </button>
              <input
                type="text"
                placeholder="Search drug or patient..."
                value={salesSearch}
                onChange={e => setSalesSearch(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400 w-full sm:w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Item / Drug Name</th>
                  <th className="px-4 py-3">Patient / Customer</th>
                  <th className="px-4 py-3 text-right">Qty Dispensed</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total Revenue</th>
                  <th className="px-4 py-3">Dispensed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredDispenses
                  .filter(d => {
                    const matches = d.drugName.toLowerCase().includes(salesSearch.toLowerCase()) ||
                      (d.patientName && d.patientName.toLowerCase().includes(salesSearch.toLowerCase())) ||
                      (d.branchName && d.branchName.toLowerCase().includes(salesSearch.toLowerCase()));
                    return matches;
                  })
                  .map(d => {
                    const drug = drugs.find(item => item.id === d.drugId);
                    const unitPrice = d.unitPrice || drug?.sellingPrice || 0;
                    const total = d.totalAmount || (unitPrice * d.quantityDispensed);
                    return (
                      <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600">
                          {format(new Date(d.createdAt), 'yyyy-MM-dd HH:mm')}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {d.drugName}
                          <span className="text-slate-400 font-normal ml-1">({drug?.unit || 'units'})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 font-medium">
                          {d.patientName || <span className="italic text-slate-400">Prescription / Walk-in</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {d.quantityDispensed}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatCurrency(unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-emerald-700 text-sm whitespace-nowrap">
                          {formatCurrency(total)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {d.branchName || 'Branch'}
                        </td>
                      </tr>
                    );
                  })}
                {filteredDispenses.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No drug dispensing or sales income records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Total Gross Income from Sales:</span>
            <span className="text-base font-black text-emerald-700">{formatCurrency(totalSalesIncome)}</span>
          </div>
        </div>
      )}

      {/* TAB 4: Drug Purchase Expenditure (Inventory Cost) */}
      {financeTab === 'drug_expenditure' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-indigo-600" />
                Drug Purchase Expenditure (Cost of Goods & Intake)
              </h3>
              <p className="text-[11px] text-slate-500">Expenditures incurred when restocking drug inventory from suppliers</p>
            </div>

            <div className="w-full sm:w-auto">
              <input
                type="text"
                placeholder="Search purchase or drug..."
                value={purchaseSearch}
                onChange={e => setPurchaseSearch(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:outline-none focus:border-slate-400 w-full sm:w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/70 text-slate-500 font-bold uppercase border-b border-slate-200 text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Drug / Supply Name</th>
                  <th className="px-4 py-3">Supplier / Invoice</th>
                  <th className="px-4 py-3 text-right">Qty Purchased</th>
                  <th className="px-4 py-3 text-right">Unit Cost Price</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3">Expiry Date</th>
                  <th className="px-4 py-3">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredPurchases
                  .filter(p => {
                    const matches = p.drugName.toLowerCase().includes(purchaseSearch.toLowerCase()) ||
                      (p.supplier && p.supplier.toLowerCase().includes(purchaseSearch.toLowerCase())) ||
                      (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(purchaseSearch.toLowerCase())) ||
                      (p.adminName && p.adminName.toLowerCase().includes(purchaseSearch.toLowerCase()));
                    return matches;
                  })
                  .map(p => {
                    const drug = drugs.find(item => item.id === p.drugId);
                    const unitCost = p.unitCostPrice || drug?.costPrice || 0;
                    const totalCost = p.totalCost || (unitCost * p.quantityPurchased);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-600">
                          {format(new Date(p.createdAt), 'yyyy-MM-dd')}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {p.drugName}
                          <span className="text-slate-400 font-normal ml-1">({drug?.unit || 'units'})</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.supplier || <span className="text-slate-400 italic">Direct Procurement</span>}
                          {p.invoiceNumber && <span className="block text-[10px] text-slate-400">Inv #{p.invoiceNumber}</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">
                          {p.quantityPurchased}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatCurrency(unitCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-extrabold text-indigo-700 text-sm whitespace-nowrap">
                          {formatCurrency(totalCost)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.expiryDate ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium font-mono">
                              {p.expiryDate}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {p.adminName || 'Admin'}
                        </td>
                      </tr>
                    );
                  })}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                      No drug purchases recorded for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-medium">Total Drug Procurement Expenditure:</span>
            <span className="text-base font-black text-indigo-700">{formatCurrency(totalDrugExpenditure)}</span>
          </div>
        </div>
      )}

      {/* TAB 5: Income & Expense (P&L) Statement */}
      {financeTab === 'pnl_statement' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col max-w-4xl mx-auto w-full">
          <div className="border-b border-slate-200 pb-4 mb-6 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">Hospital Income & Expenditure Statement</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reporting Period: {filterInterval ? `${format(filterInterval.start, 'MMM d, yyyy')} to ${format(filterInterval.end, 'MMM d, yyyy')}` : 'All Time'}
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Print / Export Statement
            </button>
          </div>

          <div className="space-y-6 text-xs">
            {/* Section 1: Income / Revenue */}
            <div>
              <div className="flex justify-between items-center py-2 border-b-2 border-slate-900 font-bold uppercase tracking-wider text-slate-900">
                <span>1. Operating Revenue & Income</span>
                <span>Amount ({currencySymbol})</span>
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-2 text-slate-700">
                  <span className="pl-4">Pharmacy Drug Dispensing & Sales Revenue</span>
                  <span className="font-semibold">{formatCurrency(totalSalesIncome)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-300 font-bold text-slate-900 bg-slate-50 px-3 rounded">
                <span>Total Gross Income (A)</span>
                <span className="text-emerald-700 font-black">{formatCurrency(totalSalesIncome)}</span>
              </div>
            </div>

            {/* Section 2: Cost of Goods Sold (Drug Purchases) */}
            <div>
              <div className="flex justify-between items-center py-2 border-b-2 border-slate-900 font-bold uppercase tracking-wider text-slate-900">
                <span>2. Direct Cost of Goods Sold (Inventory Purchases)</span>
                <span>Amount ({currencySymbol})</span>
              </div>
              <div className="divide-y divide-slate-100 py-1">
                <div className="flex justify-between py-2 text-slate-700">
                  <span className="pl-4">Pharmaceutical Drug & Consumable Purchases (Cost Price)</span>
                  <span className="font-semibold">{formatCurrency(totalDrugExpenditure)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-300 font-bold text-slate-900 bg-slate-50 px-3 rounded">
                <span>Gross Profit / Margin (Income - Drug Purchases)</span>
                <span className={`font-black ${grossProfit >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
                  {formatCurrency(grossProfit)}
                </span>
              </div>
            </div>

            {/* Section 3: Operating Expenses (OPEX) */}
            <div>
              <div className="flex justify-between items-center py-2 border-b-2 border-slate-900 font-bold uppercase tracking-wider text-slate-900">
                <span>3. Operating Expenditures (OPEX)</span>
                <span>Amount ({currencySymbol})</span>
              </div>
              <div className="divide-y divide-slate-100 py-1">
                {EXPENSE_CATEGORIES.map(cat => {
                  const amt = opexByCategory[cat.key] || 0;
                  return (
                    <div key={cat.key} className="flex justify-between py-2 text-slate-700">
                      <span className="pl-4 flex items-center gap-2">
                        <span>&bull;</span>
                        <span>{cat.label}</span>
                      </span>
                      <span className="font-mono text-slate-800">{formatCurrency(amt)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between py-2 border-t border-slate-300 font-bold text-slate-900 bg-slate-50 px-3 rounded">
                <span>Total Operating Expenditure (B)</span>
                <span className="text-orange-700 font-black">{formatCurrency(totalOperatingExpenditure)}</span>
              </div>
            </div>

            {/* Section 4: Net Profit Summary */}
            <div className="pt-4 border-t-2 border-slate-900">
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Net Balance (Income - Total Expenditure)</div>
                  <div className="text-2xl font-black mt-1">{formatCurrency(netProfit)}</div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Total Outflows</div>
                    <div className="text-sm font-bold text-red-400">{formatCurrency(totalCompanyExpenditure)}</div>
                  </div>
                  <div className="h-8 w-px bg-slate-700" />
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Profit Margin</div>
                    <div className="text-sm font-bold text-emerald-400">{profitMarginPercent}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Record Operating Expense */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-orange-400" />
                  Record Company Operating Expense
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Log salaries, electricity, generator diesel, maintenance, or other costs</p>
              </div>
              <button
                onClick={() => setShowExpenseModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2 py-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                  Expense Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPENSE_CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = expenseCategory === cat.key;
                    return (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setExpenseCategory(cat.key)}
                        className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20 font-bold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                        <span className="text-[11px] truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {expenseCategory === 'other' && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Custom Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Legal Fees, Software Subscription"
                    value={customCategoryName}
                    onChange={e => setCustomCategoryName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                    Amount ({currencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-slate-400">{currencySymbol}</span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      placeholder="0.00"
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                    Expense Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600 text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">
                  Description / Itemization <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 50 Litres of diesel for generator, July doctor salary"
                  value={expenseDescription}
                  onChange={e => setExpenseDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Payment Method</label>
                  <select
                    value={expensePaymentMethod}
                    onChange={e => setExpensePaymentMethod(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                  >
                    <option value="transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="card">POS / Debit Card</option>
                    <option value="cheque">Cheque</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Receipt / Ref # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. REC-8492"
                    value={expenseReference}
                    onChange={e => setExpenseReference(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-indigo-600"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSubmittingExpense ? 'Saving...' : 'Save Expense Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ImportSalesModal
        isOpen={isImportSalesModalOpen}
        onClose={() => setIsImportSalesModalOpen(false)}
        onSuccess={() => {
          setIsImportSalesModalOpen(false);
          alert('Past sales records imported successfully!');
        }}
        drugs={drugs}
      />
      <ImportExpensesModal
        isOpen={isImportExpensesModalOpen}
        onClose={() => setIsImportExpensesModalOpen(false)}
        onSuccess={() => {
          setIsImportExpensesModalOpen(false);
          alert('Past expenses imported successfully!');
        }}
        profile={profile}
      />
    </div>
  );
}
