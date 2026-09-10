export type Role = 'admin' | 'doctor' | 'branch' | 'store' | 'pending' | 'hmo';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  locationId?: string; // which branch they are assigned to
}

export interface Drug {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  costPrice?: number; // Cost price per unit
  sellingPrice?: number; // Selling price per unit
  branchStock?: { [locationId: string]: number }; // Maps locationId to quantity
  createdAt: number;
}

export interface ConsumableUsageRecord {
  id: string;
  userId: string;
  userName: string;
  drugId: string;
  drugName: string;
  quantityUsed: number;
  department?: string;
  createdAt: number;
}

export interface InternalTransferRecord {
  id: string;
  storeUserId: string;
  storeUserName: string;
  drugId: string;
  drugName: string;
  quantityTransferred: number;
  createdAt: number;
}

export interface Prescription {
  id: string;
  doctorId: string;
  doctorName: string;
  patientName: string;
  drugId: string;
  drugName: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  status: 'pending' | 'dispensed';
  targetBranchId?: string;
  createdAt: number;
}

export interface DispenseRecord {
  id: string;
  prescriptionId?: string;
  branchId: string;
  branchName: string;
  drugId: string;
  drugName: string;
  quantityDispensed: number;
  unitPrice?: number;
  totalAmount?: number;
  patientName?: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'insurance' | 'other';
  createdAt: number;
}

export interface PurchaseRecord {
  id: string;
  adminId: string;
  adminName: string;
  drugId: string;
  drugName: string;
  quantityPurchased: number;
  unitCostPrice?: number;
  totalCost?: number;
  supplier?: string;
  invoiceNumber?: string;
  expiryDate?: string;
  createdAt: number;
}

export type ExpenseCategory = 
  | 'salaries'
  | 'electricity'
  | 'generator_fuel'
  | 'generator_maintenance'
  | 'rent'
  | 'supplies'
  | 'logistics'
  | 'marketing'
  | 'other';

export interface OperatingExpense {
  id: string;
  adminId: string;
  adminName: string;
  category: ExpenseCategory;
  customCategory?: string;
  amount: number;
  expenseDate: string; // YYYY-MM-DD
  description: string;
  paymentMethod?: 'cash' | 'transfer' | 'card' | 'cheque' | 'other';
  referenceNumber?: string;
  createdAt: number;
}

export interface AuditReport {
  id: string;
  drugId: string;
  drugName: string;
  expectedQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  responsibleUserId: string;
  responsibleUserName: string;
  notes: string;
  adminId: string;
  createdAt: number;
}

export interface DisposalRecord {
  id: string;
  drugId: string;
  drugName: string;
  quantityDisposed: number;
  reason: string;
  notes: string;
  adminId: string;
  adminName: string;
  createdAt: number;
}



export interface InterBranchTransfer {
  id: string;
  drugId: string;
  drugName: string;
  fromLocationId: string;
  toLocationId: string;
  quantity: number;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  requestedByName: string;
  approvedBy?: string;
  approvedByName?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PharmacyBranch {
  id: string;
  name: string;
  address: string;
  email: string;
  createdAt: number;
}
