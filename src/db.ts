import { supabase } from './supabase';

export let currentTenantId: string | null = null;
export function setTenantId(id: string | null) {
  currentTenantId = id;
}

// Tables that possess an organization_id column in PostgreSQL / Supabase
const tablesWithOrgId = new Set([
  'drugs', 'purchases', 'operating_expenses', 'dispense_records',
  'audits', 'prescriptions', 'branches', 'inter_branch_transfers',
  'users', 'staff_roles'
]);

function tableHasOrgId(table: string): boolean {
  return tablesWithOrgId.has(table);
}

// Complete column schemas for Supabase tables to prevent schema cache rejections
const TABLE_SCHEMAS: Record<string, Set<string>> = {
  drugs: new Set([
    'id', 'name', 'unit', 'category', 'central_stock', 'branch_stock',
    'cost_price', 'selling_price', 'expiry_date', 'created_at', 'updated_at',
    'organization_id'
  ]),
  purchases: new Set([
    'id', 'drug_id', 'drug_name', 'quantity', 'unit_cost_price', 'total_cost_price',
    'supplier', 'invoice_number', 'expiry_date', 'created_by', 'created_by_name',
    'created_at', 'organization_id'
  ]),
  operating_expenses: new Set([
    'id', 'category', 'amount', 'description', 'date', 'created_by',
    'created_by_name', 'created_at', 'organization_id'
  ]),
  dispense_records: new Set([
    'id', 'drug_id', 'drug_name', 'quantity', 'location_id', 'dispensed_by',
    'dispensed_by_name', 'patient_id', 'prescription_id', 'selling_price',
    'total_amount', 'payment_method', 'hmo_provider', 'status', 'created_at',
    'organization_id'
  ]),
  prescriptions: new Set([
    'id', 'doctor_id', 'doctor_name', 'patient_name', 'drug_id', 'drug_name',
    'quantity', 'unit_price', 'total_price', 'status', 'target_branch_id',
    'created_at', 'organization_id'
  ]),
  disposals: new Set([
    'id', 'drug_id', 'drug_name', 'quantity', 'cost_value', 'reason', 'notes',
    'reported_by', 'reported_by_name', 'created_at'
  ]),
  audits: new Set([
    'id', 'drug_id', 'drug_name', 'missing_quantity', 'cost_value', 'selling_value',
    'responsible_user_id', 'reported_by', 'reported_by_name', 'notes',
    'created_at', 'organization_id'
  ]),
  branches: new Set([
    'id', 'name', 'address', 'email', 'created_at', 'updated_at', 'organization_id'
  ]),
  inter_branch_transfers: new Set([
    'id', 'drug_id', 'drug_name', 'from_location_id', 'to_location_id',
    'quantity_transferred', 'requested_by', 'requested_by_name', 'status',
    'created_at', 'updated_at', 'organization_id'
  ]),
  organizations: new Set([
    'id', 'name', 'status', 'created_at'
  ]),
  users: new Set([
    'id', 'name', 'email', 'role', 'location_id', 'created_at', 'organization_id'
  ]),
  staff_roles: new Set([
    'email', 'name', 'role', 'location_id', 'created_at', 'organization_id'
  ])
};

const toSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamel = (str: string) => str.replace(/_([a-z])/g, (_, g) => g.toUpperCase());

const convertKeys = (obj: any, converter: (s: string) => string): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(item => convertKeys(item, converter));
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[converter(key)] = convertKeys(obj[key], converter);
  }
  return result;
};

function toSupabasePayload(data: any, table?: string) {
  const snaked = convertKeys(data, toSnake);
  if (snaked.created_at && typeof snaked.created_at === 'number') {
    snaked.created_at = new Date(snaked.created_at).toISOString();
  }
  if (snaked.updated_at && typeof snaked.updated_at === 'number') {
    snaked.updated_at = new Date(snaked.updated_at).toISOString();
  }

  // Schema-specific column alignments for Supabase tables
  if (table === 'purchases') {
    snaked.quantity = snaked.quantity ?? snaked.quantity_purchased ?? 0;
    snaked.total_cost_price = snaked.total_cost_price ?? snaked.total_cost ?? ((snaked.unit_cost_price || 0) * (snaked.quantity || 0));
    snaked.created_by = snaked.created_by ?? snaked.admin_id;
    snaked.created_by_name = snaked.created_by_name ?? snaked.admin_name;
  } else if (table === 'operating_expenses') {
    snaked.date = snaked.date ?? snaked.expense_date ?? new Date().toISOString().split('T')[0];
    snaked.created_by = snaked.created_by ?? snaked.admin_id;
    snaked.created_by_name = snaked.created_by_name ?? snaked.admin_name;
  } else if (table === 'dispense_records') {
    snaked.quantity = snaked.quantity ?? snaked.quantity_dispensed ?? 0;
    snaked.location_id = snaked.location_id ?? snaked.branch_id;
    snaked.selling_price = snaked.selling_price ?? snaked.unit_price ?? 0;
    snaked.total_amount = snaked.total_amount ?? ((snaked.selling_price || 0) * (snaked.quantity || 0));
    snaked.patient_id = snaked.patient_id ?? snaked.patient_name;
    snaked.dispensed_by = snaked.dispensed_by ?? snaked.user_id ?? snaked.admin_id;
    snaked.dispensed_by_name = snaked.dispensed_by_name ?? snaked.user_name ?? snaked.admin_name;
  } else if (table === 'disposals') {
    snaked.quantity = snaked.quantity ?? snaked.quantity_disposed ?? 0;
    snaked.reported_by = snaked.reported_by ?? snaked.admin_id;
    snaked.reported_by_name = snaked.reported_by_name ?? snaked.admin_name;
  } else if (table === 'audits') {
    snaked.missing_quantity = snaked.missing_quantity ?? snaked.discrepancy ?? snaked.audit_missing_qty ?? 0;
    snaked.reported_by = snaked.reported_by ?? snaked.admin_id;
    snaked.reported_by_name = snaked.reported_by_name ?? snaked.admin_name;
    snaked.cost_value = snaked.cost_value ?? 0;
    snaked.selling_value = snaked.selling_value ?? 0;
  } else if (table === 'inter_branch_transfers') {
    snaked.quantity_transferred = snaked.quantity_transferred ?? snaked.quantity ?? 0;
  } else if (table === 'drugs') {
    if (snaked.branch_stock && typeof snaked.branch_stock === 'object') {
      if (snaked.central_stock === undefined && snaked.branch_stock.central !== undefined) {
        snaked.central_stock = snaked.branch_stock.central;
      }
    }
  }

  // Ensure foreign key drug_id is a valid UUID or null to prevent foreign key constraint rejections
  if (snaked.drug_id !== undefined && snaked.drug_id !== null) {
    const isUuid = typeof snaked.drug_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(snaked.drug_id);
    if (!isUuid) {
      snaked.drug_id = null;
    }
  }

  // Strict whitelist against table schema: strip any column not in table
  if (table && TABLE_SCHEMAS[table]) {
    const valid = TABLE_SCHEMAS[table];
    for (const key of Object.keys(snaked)) {
      if (!valid.has(key)) {
        delete snaked[key];
      }
    }
  }

  return snaked;
}

function fromSupabaseData(data: any, table?: string) {
  const cameled = convertKeys(data, toCamel);
  if (cameled.createdAt && typeof cameled.createdAt === 'string') {
    cameled.createdAt = new Date(cameled.createdAt).getTime();
  }
  if (cameled.updatedAt && typeof cameled.updatedAt === 'string') {
    cameled.updatedAt = new Date(cameled.updatedAt).getTime();
  }

  // Cross-populate alias fields for application components
  if (table === 'purchases' || (table === undefined && cameled.unitCostPrice !== undefined && cameled.supplier !== undefined)) {
    const qty = cameled.quantityPurchased ?? cameled.quantity ?? 0;
    cameled.quantityPurchased = qty;
    cameled.quantity = qty;

    const unitPrice = cameled.unitCostPrice ?? 0;
    const total = cameled.totalCost ?? cameled.totalCostPrice ?? (unitPrice * qty);
    cameled.totalCost = total;
    cameled.totalCostPrice = total;

    const creatorId = cameled.adminId ?? cameled.createdBy ?? '';
    cameled.adminId = creatorId;
    cameled.createdBy = creatorId;

    const creatorName = cameled.adminName ?? cameled.createdByName ?? '';
    cameled.adminName = creatorName;
    cameled.createdByName = creatorName;
  } else if (table === 'operating_expenses') {
    cameled.expenseDate = cameled.expenseDate ?? cameled.date;
    cameled.date = cameled.date ?? cameled.expenseDate;
    cameled.adminId = cameled.adminId ?? cameled.createdBy ?? '';
    cameled.adminName = cameled.adminName ?? cameled.createdByName ?? '';
  } else if (table === 'dispense_records' || (table === undefined && (cameled.prescriptionId !== undefined || cameled.dispensedBy !== undefined || cameled.sellingPrice !== undefined))) {
    const qty = cameled.quantityDispensed ?? cameled.quantity ?? 0;
    cameled.quantityDispensed = qty;
    cameled.quantity = qty;

    const branch = cameled.branchId ?? cameled.locationId ?? '';
    cameled.branchId = branch;
    cameled.locationId = branch;

    const price = cameled.unitPrice ?? cameled.sellingPrice ?? 0;
    cameled.unitPrice = price;
    cameled.sellingPrice = price;

    const total = cameled.totalAmount !== undefined && cameled.totalAmount !== null 
      ? cameled.totalAmount 
      : (price * qty);
    cameled.totalAmount = total;

    cameled.patientName = cameled.patientName ?? cameled.patientId ?? 'Walk-in Customer';

    const dispBy = cameled.dispensedBy ?? cameled.userId ?? cameled.adminId ?? '';
    cameled.dispensedBy = dispBy;

    const dispByName = cameled.dispensedByName ?? cameled.userName ?? cameled.adminName ?? 'Staff';
    cameled.dispensedByName = dispByName;
  } else if (table === 'prescriptions') {
    cameled.targetBranchId = cameled.targetBranchId ?? cameled.locationId;
    cameled.patientName = cameled.patientName ?? cameled.patientId;
  } else if (table === 'disposals') {
    cameled.quantityDisposed = cameled.quantityDisposed ?? cameled.quantity ?? 0;
    cameled.quantity = cameled.quantity ?? cameled.quantityDisposed ?? 0;
    cameled.adminId = cameled.adminId ?? cameled.reportedBy ?? '';
    cameled.adminName = cameled.adminName ?? cameled.reportedByName ?? '';
  } else if (table === 'audits') {
    cameled.discrepancy = cameled.discrepancy ?? cameled.missingQuantity ?? 0;
    cameled.missingQuantity = cameled.missingQuantity ?? cameled.discrepancy ?? 0;
    cameled.adminId = cameled.adminId ?? cameled.reportedBy ?? '';
    cameled.adminName = cameled.adminName ?? cameled.reportedByName ?? '';
  } else if (table === 'inter_branch_transfers') {
    cameled.quantityTransferred = cameled.quantityTransferred ?? cameled.quantity ?? 0;
  } else if (table === 'drugs' || cameled.centralStock !== undefined || cameled.branchStock !== undefined) {
    if (!cameled.branchStock || typeof cameled.branchStock !== 'object') {
      cameled.branchStock = {};
    }
    if (cameled.branchStock.central === undefined && cameled.centralStock !== undefined) {
      cameled.branchStock.central = Number(cameled.centralStock) || 0;
    }
    if (cameled.centralStock === undefined && cameled.branchStock.central !== undefined) {
      cameled.centralStock = Number(cameled.branchStock.central) || 0;
    }
  }

  return cameled;
}

export const db = { isPolyfill: true };

export function collection(dbRef: any, path: string) { return { _type: 'collection', path }; }

export function doc(...args: any[]) {
  if (args.length === 1 && args[0]?._type === 'collection') {
    return { _type: 'doc', table: args[0].path, id: crypto.randomUUID() };
  }
  if (args.length === 2 && args[0]?._type === 'collection') {
    return { _type: 'doc', table: args[0].path, id: args[1] };
  }
  if (args.length === 3) {
    return { _type: 'doc', table: args[1], id: args[2] };
  }
  const path = args[1] || '';
  const parts = path.split('/');
  return { _type: 'doc', table: parts[0], id: parts[1] || crypto.randomUUID() };
}

export function query(col: any, ...constraints: any[]) { return { ...col, constraints }; }
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') { return { _type: 'orderBy', field, direction }; }
export function where(field: string, op: string, value: any) { return { _type: 'where', field, op, value }; }
export function limit(n: number) { return { _type: 'limit', value: n }; }
export function increment(n: number) { return { _type: 'increment', value: n }; }

export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static now() { return new Timestamp(Math.floor(Date.now() / 1000), 0); }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1000000; }
}

function getPrimaryKey(table: string) {
  if (table === 'staff_roles') return 'email';
  return 'id';
}

export async function addDoc(colRef: any, data: any) {
  const table = colRef.path;
  const payload = toSupabasePayload(data, table);
  if (currentTenantId && tableHasOrgId(table) && !payload.organization_id) {
    payload.organization_id = currentTenantId;
  }
  const { data: res, error } = await supabase.from(table).insert(payload).select().single();
  if (error) { console.error("addDoc error", error); throw error; }
  const pk = getPrimaryKey(table);
  return { id: res[pk] };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  const table = docRef.table;
  const payload = toSupabasePayload(data, table);
  const pk = getPrimaryKey(table);
  payload[pk] = docRef.id;
  if (currentTenantId && tableHasOrgId(table) && !payload.organization_id) {
    payload.organization_id = currentTenantId;
  }
  if (options?.merge) {
    const updatePayload = { ...payload };
    delete updatePayload[pk];
    const { data: updated, error: updateError } = await supabase.from(table).update(updatePayload).eq(pk, docRef.id).select();
    if (!updateError && updated && updated.length > 0) {
      return;
    }
  }
  const { error } = await supabase.from(table).upsert(payload);
  if (error) { console.error("setDoc error", error); throw error; }
}

export async function updateDoc(docRef: any, data: any) {
  const table = docRef.table;
  const pk = getPrimaryKey(table);
  const payload = toSupabasePayload(data, table);
  delete payload[pk];

  const dotKeys = Object.keys(data).filter(k => k.includes('.'));
  let hasIncrement = false;
  for (const k of Object.keys(data)) {
    if (data[k]?._type === 'increment') { hasIncrement = true; break; }
  }
  for (const k of Object.keys(payload)) {
    if (payload[k]?._type === 'increment') { hasIncrement = true; break; }
  }

  // Handle dot notation updates (e.g. branchStock.central) or increment fields
  if (dotKeys.length > 0 || hasIncrement) {
    const { data: existing, error: fetchErr } = await supabase.from(table).select('*').eq(pk, docRef.id).maybeSingle();
    if (fetchErr) {
      console.error("updateDoc fetch error", fetchErr);
      throw fetchErr;
    }
    if (existing) {
      if (table === 'drugs' || dotKeys.some(k => k.startsWith('branchStock.') || k.startsWith('branch_stock.'))) {
        const currentBranchStock = { ...(existing.branch_stock || {}) };
        for (const k of Object.keys(data)) {
          if (k.startsWith('branchStock.') || k.startsWith('branch_stock.')) {
            const sub = k.split('.')[1];
            const val = data[k];
            const curVal = Number(currentBranchStock[sub] || 0);
            const finalVal = (val && typeof val === 'object' && val._type === 'increment')
              ? (curVal + Number(val.value))
              : Number(val);
            currentBranchStock[sub] = finalVal;
            if (sub === 'central') {
              payload.central_stock = finalVal;
            }
          }
        }
        payload.branch_stock = currentBranchStock;
      }

      // Handle standard non-nested increment keys
      for (const k of Object.keys(payload)) {
        if (payload[k]?._type === 'increment') {
          payload[k] = (Number(existing[k]) || 0) + payload[k].value;
        }
      }
    }
  }

  // Purge any dot keys from payload so Postgres schema cache does not reject them
  for (const k of Object.keys(payload)) {
    if (k.includes('.')) {
      delete payload[k];
    }
  }

  const { error } = await supabase.from(table).update(payload).eq(pk, docRef.id);
  if (error) { console.error("updateDoc error", error); throw error; }
}

export async function deleteDoc(docRef: any) {
  const table = docRef.table;
  const pk = getPrimaryKey(table);

  if (table === 'drugs') {
    // Delete referencing records across child tables to satisfy foreign key constraints
    await Promise.allSettled([
      supabase.from('purchases').delete().eq('drug_id', docRef.id),
      supabase.from('dispense_records').delete().eq('drug_id', docRef.id),
      supabase.from('prescriptions').delete().eq('drug_id', docRef.id),
      supabase.from('disposals').delete().eq('drug_id', docRef.id),
      supabase.from('audits').delete().eq('drug_id', docRef.id),
      supabase.from('inter_branch_transfers').delete().eq('drug_id', docRef.id)
    ]);
  }

  const { error } = await supabase.from(table).delete().eq(pk, docRef.id);
  if (error) { console.error("deleteDoc error", error); throw error; }
}

export async function getDoc(docRef: any) {
  const table = docRef.table;
  const pk = getPrimaryKey(table);
  const { data, error } = await supabase.from(table).select('*').eq(pk, docRef.id).maybeSingle();
  if (error) { console.error("getDoc error", error); throw error; }
  if (!data) return { exists: () => false, data: () => undefined, id: docRef.id };
  return { exists: () => true, id: docRef.id, data: () => fromSupabaseData(data, table) };
}

export async function getDocs(queryRef: any) {
  const table = queryRef.path;
  let sbQuery = supabase.from(table).select('*');
  if (currentTenantId && tableHasOrgId(table)) {
    sbQuery = sbQuery.eq('organization_id', currentTenantId);
  }
  if (queryRef.constraints) {
    for (const c of queryRef.constraints) {
      if (c._type === 'where') {
         if (c.op === '==') sbQuery = sbQuery.eq(toSnake(c.field), c.value);
         else if (c.op === '>') sbQuery = sbQuery.gt(toSnake(c.field), c.value);
         else if (c.op === '<') sbQuery = sbQuery.lt(toSnake(c.field), c.value);
         else if (c.op === '>=') sbQuery = sbQuery.gte(toSnake(c.field), c.value);
         else if (c.op === '<=') sbQuery = sbQuery.lte(toSnake(c.field), c.value);
      }
      if (c._type === 'orderBy') sbQuery = sbQuery.order(toSnake(c.field), { ascending: c.direction === 'asc' });
      if (c._type === 'limit') sbQuery = sbQuery.limit(c.value);
    }
  }
  const { data, error } = await sbQuery;
  if (error) { console.error("getDocs error", error); throw error; }
  const pk = getPrimaryKey(table);
  return { docs: (data || []).map(d => ({ id: d[pk], data: () => fromSupabaseData(d, table) })) };
}

export function writeBatch(dbRef: any) {
  const ops: Promise<any>[] = [];
  return {
    update(docRef: any, data: any) { ops.push(updateDoc(docRef, data)); },
    set(docRef: any, data: any, opts?: any) { ops.push(setDoc(docRef, data, opts)); },
    delete(docRef: any) { ops.push(deleteDoc(docRef)); },
    async commit() { await Promise.all(ops); }
  };
}

export function onSnapshot(ref: any, onNext: (snap: any) => void, onError?: (err: any) => void) {
  const table = ref.path;
  let currentData: any[] = [];

  const emit = () => {
    let sorted = [...currentData];
    if (ref.constraints) {
      // Apply where clauses locally
      for (const c of ref.constraints) {
        if (c._type === 'where') {
          sorted = sorted.filter(item => {
            const val = item[c.field];
            if (c.op === '==') return val === c.value;
            if (c.op === '>') return val > c.value;
            if (c.op === '<') return val < c.value;
            if (c.op === '>=') return val >= c.value;
            if (c.op === '<=') return val <= c.value;
            return true;
          });
        }
      }
      // Apply sorting
      const order = ref.constraints.find((c: any) => c._type === 'orderBy');
      if (order) {
        sorted.sort((a, b) => {
          const valA = a[order.field];
          const valB = b[order.field];
          if (valA < valB) return order.direction === 'asc' ? -1 : 1;
          if (valA > valB) return order.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
    }
    onNext({ docs: sorted.map(d => {
      const pk = getPrimaryKey(table);
      const camelPk = toCamel(pk);
      return { id: d[camelPk], data: () => d };
    }) });
  };

  let sbQuery = supabase.from(table).select('*');
  if (currentTenantId && tableHasOrgId(table)) {
    sbQuery = sbQuery.eq('organization_id', currentTenantId);
  }
  if (ref.constraints) {
    for (const c of ref.constraints) {
      if (c._type === 'where') {
         if (c.op === '==') sbQuery = sbQuery.eq(toSnake(c.field), c.value);
         else if (c.op === '>') sbQuery = sbQuery.gt(toSnake(c.field), c.value);
         else if (c.op === '<') sbQuery = sbQuery.lt(toSnake(c.field), c.value);
         else if (c.op === '>=') sbQuery = sbQuery.gte(toSnake(c.field), c.value);
         else if (c.op === '<=') sbQuery = sbQuery.lte(toSnake(c.field), c.value);
      }
      if (c._type === 'orderBy') {
        sbQuery = sbQuery.order(toSnake(c.field), { ascending: c.direction === 'asc' });
      }
      if (c._type === 'limit') {
        sbQuery = sbQuery.limit(c.value);
      }
    }
  }

  sbQuery.then(({ data, error }) => {
    if (error) { if (onError) onError(error); return; }
    currentData = (data || []).map(d => fromSupabaseData(d, table));
    emit();
  });

  const channel = supabase.channel(`public:${table}_${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      if (currentTenantId && tableHasOrgId(table)) {
        const itemOrgId = (payload.new as any)?.organization_id || (payload.old as any)?.organization_id;
        if (itemOrgId && itemOrgId !== currentTenantId) return;
      }
      const pk = getPrimaryKey(table);
      const camelPk = toCamel(pk);
      if (payload.eventType === 'INSERT') {
        currentData.unshift(fromSupabaseData(payload.new, table));
      } else if (payload.eventType === 'UPDATE') {
        const updated = fromSupabaseData(payload.new, table);
        currentData = currentData.map(item => item[camelPk] === updated[camelPk] ? updated : item);
      } else if (payload.eventType === 'DELETE') {
        currentData = currentData.filter(item => item[camelPk] !== payload.old[pk]);
      }
      emit();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
