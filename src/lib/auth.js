import { supabase } from './supabase.js'

export const ROLES = {
  STORE:         'store',
  AREA_MANAGER:  'area_manager',
  GROUP_MANAGER: 'group_manager',
  HEADQUARTERS:  'headquarters',
  SUPER_ADMIN:   'super_admin',
}

export const ROLE_LABELS = {
  store:         '門店人員',
  area_manager:  '區域主管',
  group_manager: '事業群主管',
  headquarters:  '總部',
  super_admin:   '最高管理員',
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function resolveRole(email) {
  // 1. 確認角色與回覆權限
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role, can_reply')
    .eq('email', email)
    .single()

  if (!userRole) return null

  const role     = userRole.role
  // super_admin 若 DB 未設定（舊資料），仍預設為 true
  const canReply = userRole.can_reply ?? (role === ROLES.SUPER_ADMIN)

  // 2. 依角色查詢對應的範圍（門店/區域/事業群）
  if (role === ROLES.STORE) {
    const { data } = await supabase
      .from('store_members')
      .select('store_id, stores(store_name)')
      .eq('email', email)
    return {
      role, canReply,
      scopeIds:   data?.map(r => r.store_id) ?? [],
      scopeNames: data?.map(r => r.stores?.store_name).filter(Boolean) ?? [],
    }
  }

  if (role === ROLES.AREA_MANAGER) {
    const { data } = await supabase
      .from('area_members')
      .select('area_id')
      .eq('email', email)
    return {
      role, canReply,
      scopeIds:   data?.map(r => r.area_id) ?? [],
      scopeNames: [],
    }
  }

  if (role === ROLES.GROUP_MANAGER) {
    const { data } = await supabase
      .from('business_group_members')
      .select('business_group_id')
      .eq('email', email)
    return {
      role, canReply,
      scopeIds:   data?.map(r => r.business_group_id) ?? [],
      scopeNames: [],
    }
  }

  // headquarters / super_admin — 全域存取，不需 scope
  return { role, canReply, scopeIds: [], scopeNames: [] }
}

// 全域角色查評論時不以 stores 表過濾，未登記門店的評論也要看得到
export function hasGlobalAccess(roleInfo) {
  return roleInfo.role === ROLES.SUPER_ADMIN || roleInfo.role === ROLES.HEADQUARTERS
}

export async function getAccessibleStoreNames(roleInfo) {
  const { role, scopeIds, scopeNames } = roleInfo
  let names = []

  if (role === ROLES.SUPER_ADMIN || role === ROLES.HEADQUARTERS) {
    const { data } = await supabase.from('stores').select('store_name')
    names = data?.map(s => s.store_name) ?? []
  } else if (role === ROLES.GROUP_MANAGER) {
    const { data } = await supabase
      .from('stores')
      .select('store_name')
      .in('business_group_id', scopeIds)
    names = data?.map(s => s.store_name) ?? []
  } else if (role === ROLES.AREA_MANAGER) {
    const { data } = await supabase
      .from('stores')
      .select('store_name')
      .in('area_id', scopeIds)
    names = data?.map(s => s.store_name) ?? []
  } else if (role === ROLES.STORE) {
    names = scopeNames ?? []
  }

  // 去除重複
  return [...new Set(names)]
}

// 回傳 [{ id, name, stores }]，只含 storeNames 中至少有一間門店的品牌
export async function getAccessibleBrands(storeNames) {
  const [{ data: brandRows }, { data: storeRows }] = await Promise.all([
    supabase.from('google_group').select('id, group_name').order('id'),
    supabase.from('stores').select('store_name, group_id'),
  ])
  const accessible  = new Set(storeNames)
  const brandStores = {}
  for (const s of storeRows ?? []) {
    if (!s.group_id || !accessible.has(s.store_name)) continue
    ;(brandStores[s.group_id] ??= new Set()).add(s.store_name)
  }
  return (brandRows ?? [])
    .filter(b => brandStores[b.id])
    .map(b => ({ id: String(b.id), name: b.group_name, stores: [...brandStores[b.id]].sort() }))
}
