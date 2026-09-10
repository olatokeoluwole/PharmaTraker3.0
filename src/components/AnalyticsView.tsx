import React, { useMemo } from 'react';
import { UserProfile, Drug, PurchaseRecord, DispenseRecord } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Package,
  Copy, BarChart3, LineChart as LineChartIcon
} from 'lucide-react';
import { isToday, isYesterday, isThisMonth, isSameMonth, subMonths, parseISO, format, getHours } from 'date-fns';

interface AnalyticsViewProps {
  profile: UserProfile;
  drugs: Drug[];
  purchases: PurchaseRecord[];
  dispenses: DispenseRecord[];
}

export default function AnalyticsView({ profile, drugs, purchases, dispenses }: AnalyticsViewProps) {
  const {
    todaySales,
    monthlySales,
    todaySalesChange,
    monthlySalesChange,
    grossProfitMargin,
    grossProfitVal,
    inventoryValue,
    topItems,
    topCategories,
    bottomItems,
    bottomCategories,
    salesByPaymentType,
    salesPerHour
  } = useMemo(() => {
    
    // Base Metrics
    let todaySales = 0;
    let yesterdaySales = 0;
    let monthlySales = 0;
    let lastMonthSales = 0;
    let totalRevenue = 0;
    let totalCostOfGoods = 0;
    let monthlyCostOfGoods = 0;
    
    const itemsMap: Record<string, { name: string, count: number, revenue: number }> = {};
    const categoriesMap: Record<string, { name: string, count: number, revenue: number }> = {};
    const paymentMap: Record<string, number> = {
      'insurance': 0,
      'card': 0,
      'cash': 0,
      'transfer': 0,
      'other': 0
    };
    
    // Initialize hours 8A to 8P (8 to 20)
    const hoursMap: Record<number, number> = {};
    for (let i = 8; i <= 20; i++) {
      hoursMap[i] = 0;
    }
    
    // Process Dispenses (Sales)
    dispenses.forEach(d => {
      const date = typeof d.createdAt === 'number' ? new Date(d.createdAt) : parseISO(d.createdAt as unknown as string);
      const isTd = isToday(date);
      const isTm = isThisMonth(date);
      const isYd = isYesterday(date);
      const isLm = isSameMonth(date, subMonths(new Date(), 1));
      const rev = d.totalAmount || 0;
      
      if (isTd) todaySales += rev;
      if (isYd) yesterdaySales += rev;
      if (isTm) monthlySales += rev;
      if (isLm) lastMonthSales += rev;
      
      totalRevenue += rev;
      
      // Calculate COGS by finding the drug's cost price
      const drug = drugs.find(dr => dr.id === d.drugId);
      if (drug) {
        totalCostOfGoods += (drug.costPrice || 0) * d.quantityDispensed;
        if (isTm) monthlyCostOfGoods += (drug.costPrice || 0) * d.quantityDispensed;
        
        // Item stats
        if (!itemsMap[drug.id]) itemsMap[drug.id] = { name: drug.name, count: 0, revenue: 0 };
        itemsMap[drug.id].count += d.quantityDispensed;
        itemsMap[drug.id].revenue += rev;
        
        // Category stats
        const cat = drug.category || 'Uncategorized';
        if (!categoriesMap[cat]) categoriesMap[cat] = { name: cat, count: 0, revenue: 0 };
        categoriesMap[cat].count += d.quantityDispensed;
        categoriesMap[cat].revenue += rev;
      }
      
      // Hourly stats
      const hour = getHours(date);
      if (hour >= 8 && hour <= 20) {
        hoursMap[hour] += rev;
      }
      
      const method = (d.paymentMethod || 'cash').toLowerCase();
      if (method === 'insurance') paymentMap.insurance += rev;
      else if (method === 'card' || method === 'pos') paymentMap.card += rev;
      else if (method === 'transfer') paymentMap.transfer += rev;
      else if (method === 'cash') paymentMap.cash += rev;
      else paymentMap.other += rev;
    });
    
    // Margins (Current Month)
    const grossProfitVal = monthlySales - monthlyCostOfGoods;
    const grossProfitMargin = monthlySales > 0 ? (grossProfitVal / monthlySales) * 100 : 0;
    
    // Inventory Value
    const inventoryValue = drugs.reduce((acc, d) => {
      const totalStock = Object.values(d.branchStock || {}).reduce((a, b) => a + (b as number || 0), 0);
      return acc + (totalStock * (d.sellingPrice || d.costPrice || 0));
    }, 0);
    
    // Sort items
    const sortedItems = Object.values(itemsMap).sort((a, b) => b.revenue - a.revenue);
    const topItems = sortedItems.slice(0, 10);
    const bottomItems = sortedItems.slice().reverse().slice(0, 10);
    
    // Sort categories
    const sortedCategories = Object.values(categoriesMap).sort((a, b) => b.revenue - a.revenue);
    const topCategories = sortedCategories.slice(0, 5);
    const bottomCategories = sortedCategories.slice().reverse().slice(0, 5);
    
    // Payment type percentages
    const totalPayments = Object.values(paymentMap).reduce((a, b) => a + b, 0);
    const salesByPaymentType = [
      { name: 'INSURANCE', value: totalPayments ? (paymentMap.insurance / totalPayments) * 100 : 0 },
      { name: 'CARD', value: totalPayments ? (paymentMap.card / totalPayments) * 100 : 0 },
      { name: 'CASH', value: totalPayments ? (paymentMap.cash / totalPayments) * 100 : 0 },
      { name: 'TRANSFER', value: totalPayments ? (paymentMap.transfer / totalPayments) * 100 : 0 },
      { name: 'OTHER', value: totalPayments ? (paymentMap.other / totalPayments) * 100 : 0 },
    ].sort((a, b) => b.value - a.value);
    
    // Chart data
    const salesPerHour = Object.keys(hoursMap).map(h => {
      const hr = parseInt(h);
      const label = hr === 12 ? '12P' : hr > 12 ? `${hr - 12}P` : `${hr}A`;
      return { time: label, sales: hoursMap[hr] };
    });

    const todaySalesChange = yesterdaySales === 0 ? (todaySales > 0 ? 100 : 0) : ((todaySales - yesterdaySales) / yesterdaySales) * 100;
    const monthlySalesChange = lastMonthSales === 0 ? (monthlySales > 0 ? 100 : 0) : ((monthlySales - lastMonthSales) / lastMonthSales) * 100;
    
    return {
      todaySales,
      todaySalesChange,
      monthlySalesChange,
      monthlySales,
      grossProfitMargin,
      grossProfitVal,
      inventoryValue,
      topItems,
      topCategories,
      bottomItems,
      bottomCategories,
      salesByPaymentType,
      salesPerHour
    };
  }, [dispenses, drugs]);

  const formatCurrency = (val: number) => `₦${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-4 font-sans bg-[#f7f8f9] min-h-screen text-slate-800">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h1 className="text-xl font-bold uppercase tracking-wide flex items-center">
          <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" /> PharmaTracker 3.0 <span className="font-light ml-2 text-sm text-slate-500 capitalize tracking-normal">Business Intelligence View</span>
        </h1>
      </div>
      
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Today's Sales</span>
            <DollarSign className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black">{formatCurrency(todaySales)}</span>
            <span className={`text-[10px] flex items-center px-1 py-0.5 font-bold mb-1 border ${todaySalesChange >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {todaySalesChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(todaySalesChange).toFixed(1)}%
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase mt-2">VS YESTERDAY</span>
        </div>

        {/* Monthly Sales */}
        <div className="bg-white p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monthly Sales</span>
            <LineChartIcon className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black">{formatCurrency(monthlySales)}</span>
            <span className={`text-[10px] flex items-center px-1 py-0.5 font-bold mb-1 border ${monthlySalesChange >= 0 ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {monthlySalesChange >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(monthlySalesChange).toFixed(1)}%
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase mt-2">VS LAST MONTH</span>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Profit</span>
            <Copy className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black">{formatCurrency(grossProfitVal)}</span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1 py-0.5 mb-1 border border-slate-200 uppercase">
              {grossProfitMargin.toFixed(1)}% Margin
            </span>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase mt-2">CURRENT MONTH</span>
        </div>

        {/* Inventory Value */}
        <div className="bg-white p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory Value</span>
            <Package className="w-4 h-4 text-slate-300" />
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black">{formatCurrency(inventoryValue)}</span>
          </div>
          <span className="text-[9px] font-bold text-slate-400 uppercase mt-2">CURRENT STOCK VALUATION</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Top 10 Selling Items */}
        <div className="lg:col-span-3 bg-white border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold font-serif italic text-lg text-slate-800">Top 10 Selling Items</h2>
          </div>
          <div className="p-0 overflow-auto max-h-[300px]">
            <table className="w-full text-xs text-left">
              <thead className="text-[9px] text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3 text-right">Sales Count</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-600">{item.name}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{item.count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(item.revenue)}</td>
                  </tr>
                ))}
                {topItems.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 5 Categories */}
        <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold font-serif italic text-lg text-slate-800">Top 5 Categories</h2>
          </div>
          <div className="p-0 overflow-auto max-h-[300px]">
            <table className="w-full text-xs text-left">
              <thead className="text-[9px] text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Sales Count</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topCategories.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium flex items-center">
                      <div className="w-1.5 h-1.5 bg-emerald-500 mr-2 rounded-full"></div>
                      <span className="text-slate-600">{cat.name}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{cat.count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(cat.revenue)}</td>
                  </tr>
                ))}
                {topCategories.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Sales by Payment Type */}
        <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold font-serif italic text-lg text-slate-800">Sales by Payment Type</h2>
          </div>
          <div className="p-6 flex flex-col gap-4">
            {salesByPaymentType.map((pt, idx) => {
              let barColor = 'bg-slate-500';
              if (pt.name.toLowerCase() === 'cash') barColor = 'bg-emerald-500';
              if (pt.name.toLowerCase() === 'card') barColor = 'bg-blue-500';
              if (pt.name.toLowerCase() === 'transfer') barColor = 'bg-indigo-500';
              if (pt.name.toLowerCase() === 'insurance') barColor = 'bg-amber-500';
              return (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-[9px] font-bold text-slate-500 uppercase w-16 text-right">{pt.name}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
                  <div className={`h-full ${barColor}`} style={{ width: `${pt.value}%` }}></div>
                </div>
                <span className="text-[10px] font-bold text-slate-700 w-8 text-right">{Math.round(pt.value)}%</span>
              </div>
            );})}
          </div>
        </div>

        {/* Sales per Hour */}
        <div className="lg:col-span-3 bg-white border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold font-serif italic text-lg text-slate-800">Sales per Hour</h2>
          </div>
          <div className="p-4 flex-1 min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesPerHour} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 'bold' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickFormatter={val => val >= 1000 ? `₦${val/1000}k` : `₦${val}`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}
                  formatter={(val: number) => [formatCurrency(val), 'Sales']}
                />
                <Bar dataKey="sales" fill="#4f46e5" radius={[2, 2, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Bottom 10 Selling Items */}
        <div className="lg:col-span-3 bg-white border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="font-bold font-serif italic text-lg text-slate-800">Bottom 10 Selling Items</h2>
            <span className="text-[8px] font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-rose-600 uppercase tracking-widest rounded-sm">Attention Required</span>
          </div>
          <div className="p-0 overflow-auto max-h-[300px]">
            <table className="w-full text-xs text-left">
              <thead className="text-[9px] text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3 text-right">Sales Count</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bottomItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-600">{item.name}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{item.count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(item.revenue)}</td>
                  </tr>
                ))}
                {bottomItems.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom 5 Categories */}
        <div className="lg:col-span-2 bg-white border border-slate-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200">
            <h2 className="font-bold font-serif italic text-lg text-slate-800">Bottom 5 Categories</h2>
          </div>
          <div className="p-0 overflow-auto max-h-[300px]">
            <table className="w-full text-xs text-left">
              <thead className="text-[9px] text-slate-500 font-bold uppercase border-b border-slate-200 sticky top-0 bg-white">
                <tr>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Sales Count</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bottomCategories.map((cat, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-600">{cat.name}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{cat.count.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{formatCurrency(cat.revenue)}</td>
                  </tr>
                ))}
                {bottomCategories.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-slate-400">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
