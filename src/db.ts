import { supabase } from './supabase';

export let currentTenantId: string | null = null;
export function setTenantId(id: string | null) {
  currentTenantId = id;
}

const toSnake = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamel = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const convertKeys = (obj: any, converter: (s: string) => string): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(item => convertKeys(item, converter));
  const result: any = {};
  for (const key of Object.keys(obj)) {
    result[converter(key)] = convertKeys(obj[key], converter);
  }
  return result;
};

function toSupabasePayload(data: any) {
  const snaked = convertKeys(data, toSnake);
  if (snaked.created_at && typeof snaked.created_at === 'number') {
    snaked.created_at = new Date(snaked.created_at).toISOString();
  }
  if (snaked.updated_at && typeof snaked.updated_at === 'number') {
    snaked.updated_at = new Date(snaked.updated_at).toISOString();
  }
  return snaked;
}

function fromSupabaseData(data: any) {
  const cameled = convertKeys(data, toCamel);
  if (cameled.createdAt && typeof cameled.createdAt === 'string') {
    cameled.createdAt = new Date(cameled.createdAt).getTime();
  }
  if (cameled.updatedAt && typeof cameled.updatedAt === 'string') {
    cameled.updatedAt = new Date(cameled.updatedAt).getTime();
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
  const payload = toSupabasePayload(data);
  if (currentTenantId && table !== 'organizations' && !payload.organization_id) {
    payload.organization_id = currentTenantId;
  }
  const { data: res, error } = await supabase.from(table).insert(payload).select().single();
  if (error) { console.error("addDoc error", error); throw error; }
  const pk = getPrimaryKey(table);
  return { id: res[pk] };
}

export async function setDoc(docRef: any, data: any, options?: { merge?: boolean }) {
  const payload = toSupabasePayload(data);
  const pk = getPrimaryKey(docRef.table);
  payload[pk] = docRef.id;
  if (currentTenantId && docRef.table !== 'organizations' && !payload.organization_id) {
    payload.organization_id = currentTenantId;
  }
  const { error } = await supabase.from(docRef.table).upsert(payload);
  if (error) { console.error("setDoc error", error); throw error; }
}

export async function updateDoc(docRef: any, data: any) {
  const payload = toSupabasePayload(data);
  const pk = getPrimaryKey(docRef.table);
  delete payload[pk];
  let hasIncrement = false;
  for (const k of Object.keys(payload)) {
    if (payload[k]?._type === 'increment') { hasIncrement = true; break; }
  }
  if (hasIncrement) {
    const { data: existing } = await supabase.from(docRef.table).select('*').eq(pk, docRef.id).single();
    if (existing) {
      for (const k of Object.keys(payload)) {
        if (payload[k]?._type === 'increment') payload[k] = (existing[k] || 0) + payload[k].value;
      }
    }
  }
  const { error } = await supabase.from(docRef.table).update(payload).eq(pk, docRef.id);
  if (error) { console.error("updateDoc error", error); throw error; }
}

export async function deleteDoc(docRef: any) {
  const pk = getPrimaryKey(docRef.table);
  const { error } = await supabase.from(docRef.table).delete().eq(pk, docRef.id);
  if (error) { console.error("deleteDoc error", error); throw error; }
}

export async function getDoc(docRef: any) {
  const pk = getPrimaryKey(docRef.table);
  const { data, error } = await supabase.from(docRef.table).select('*').eq(pk, docRef.id).maybeSingle();
  if (error) { console.error("getDoc error", error); throw error; }
  if (!data) return { exists: () => false, data: () => undefined, id: docRef.id };
  return { exists: () => true, id: docRef.id, data: () => fromSupabaseData(data) };
}

export async function getDocs(queryRef: any) {
  const table = queryRef.path;
  let sbQuery = supabase.from(table).select('*');
  if (currentTenantId && table !== 'organizations') {
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
  return { docs: (data || []).map(d => ({ id: d[pk], data: () => fromSupabaseData(d) })) };
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
  if (currentTenantId && table !== 'organizations') {
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
    currentData = (data || []).map(d => fromSupabaseData(d));
    emit();
  });

  const channel = supabase.channel(`public:${table}_${Math.random()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      if (currentTenantId && table !== 'organizations') {
        const itemOrgId = (payload.new as any)?.organization_id || (payload.old as any)?.organization_id;
        if (itemOrgId && itemOrgId !== currentTenantId) return;
      }
      const pk = getPrimaryKey(table);
      const camelPk = toCamel(pk);
      if (payload.eventType === 'INSERT') {
        currentData.push(fromSupabaseData(payload.new));
      } else if (payload.eventType === 'UPDATE') {
        const updated = fromSupabaseData(payload.new);
        currentData = currentData.map(item => item[camelPk] === updated[camelPk] ? updated : item);
      } else if (payload.eventType === 'DELETE') {
        currentData = currentData.filter(item => item[camelPk] !== payload.old[pk]);
      }
      emit();
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}
