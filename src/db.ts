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
    if (snaked.quantity === undefined && snaked.quantity_purchased !== undefined) {
      snaked.quantity = snaked.quantity_purchased;
    }
    delete snaked.quantity_purchased;

    if (snaked.total_cost_price === undefined) {
      if (snaked.total_cost !== undefined) {
        snaked.total_cost_price = snaked.total_cost;
      } else if (snaked.unit_cost_price !== undefined && snaked.quantity !== undefined) {
        snaked.total_cost_price = snaked.unit_cost_price * snaked.quantity;
      }
    }
    delete snaked.total_cost;

    if (snaked.created_by === undefined && snaked.admin_id !== undefined) {
      snaked.created_by = snaked.admin_id;
    }
    delete snaked.admin_id;

    if (snaked.created_by_name === undefined && snaked.admin_name !== undefined) {
      snaked.created_by_name = snaked.admin_name;
    }
    delete snaked.admin_name;
  } else if (table === 'disposals') {
    if (snaked.quantity === undefined && snaked.quantity_disposed !== undefined) {
      snaked.quantity = snaked.quantity_disposed;
    }
    delete snaked.quantity_disposed;

    if (snaked.reported_by === undefined && snaked.admin_id !== undefined) {
      snaked.reported_by = snaked.admin_id;
    }
    delete snaked.admin_id;

    if (snaked.reported_by_name === undefined && snaked.admin_name !== undefined) {
      snaked.reported_by_name = snaked.admin_name;
    }
    delete snaked.admin_name;

    delete snaked.organization_id;

    const validDisposalColumns = new Set([
      'id', 'drug_id', 'drug_name', 'quantity', 'cost_value', 'reason', 'notes',
      'reported_by', 'reported_by_name', 'created_at'
    ]);
    for (const key of Object.keys(snaked)) {
      if (!validDisposalColumns.has(key)) {
        delete snaked[key];
      }
    }
  } else if (table === 'audits') {
    if (snaked.missing_quantity === undefined) {
      snaked.missing_quantity = snaked.discrepancy ?? snaked.audit_missing_qty ?? 0;
    }
    delete snaked.discrepancy;
    delete snaked.audit_missing_qty;

    if (snaked.reported_by === undefined && snaked.admin_id !== undefined) {
      snaked.reported_by = snaked.admin_id;
    }
    delete snaked.admin_id;

    if (snaked.reported_by_name === undefined && snaked.admin_name !== undefined) {
      snaked.reported_by_name = snaked.admin_name;
    }
    delete snaked.admin_name;

    const validAuditColumns = new Set([
      'id', 'drug_id', 'drug_name', 'missing_quantity', 'cost_value', 'selling_value',
      'responsible_user_id', 'reported_by', 'reported_by_name', 'notes', 'created_at', 'organization_id'
    ]);
    for (const key of Object.keys(snaked)) {
      if (!validAuditColumns.has(key)) {
        delete snaked[key];
      }
    }
  } else if (table === 'drugs') {
    if (snaked.branch_stock && typeof snaked.branch_stock === 'object') {
      if (snaked.central_stock === undefined && snaked.branch_stock.central !== undefined) {
        snaked.central_stock = snaked.branch_stock.central;
      }
    }
    // Only allow columns that actually exist in PostgreSQL 'drugs' table
    const validDrugColumns = new Set([
      'id', 'name', 'unit', 'category', 'central_stock', 'branch_stock',
      'cost_price', 'selling_price', 'expiry_date', 'created_at', 'updated_at',
      'organization_id'
    ]);
    for (const key of Object.keys(snaked)) {
      if (!validDrugColumns.has(key)) {
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
  if (table === 'purchases' || cameled.unitCostPrice !== undefined || data.total_cost_price !== undefined || data.quantity !== undefined) {
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
  } else if (table === 'disposals') {
    cameled.quantityDisposed = cameled.quantityDisposed ?? cameled.quantity ?? 0;
    cameled.adminId = cameled.adminId ?? cameled.reportedBy ?? '';
    cameled.adminName = cameled.adminName ?? cameled.reportedByName ?? '';
  } else if (table === 'audits') {
    cameled.discrepancy = cameled.discrepancy ?? cameled.missingQuantity ?? 0;
    cameled.adminId = cameled.adminId ?? cameled.reportedBy ?? '';
    cameled.adminName = cameled.adminName ?? cameled.reportedByName ?? '';
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
        currentData.push(fromSupabaseData(payload.new, table));
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
