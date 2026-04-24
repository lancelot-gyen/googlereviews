import { supabase } from './supabase.js'

export const ROLES = {
  STORE: 'store',
  AREA_MANAGER: 'area_manager',
  GROUP_MANAGER: 'group_manager',
  HEADQUARTERS: 'headquarters',
  SUPER_ADMIN: 'super_admin',
}

export const ROLE_LABELS = {
  store: '門店人員',
  area_manager: '區域主管',
  group_manager: '事業群主管',
  headquarters: '總部',
  super_admin: '最高管理員',
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

/**
 * Step 1: 查 user_roles 取得 role
 * Step 2: 依 role 查對應 members 表取得 scopeIds
 */
export async function resolveRole(email) {
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .single()

  if (!userRole) return null

  const role = userRole.role

  if (role === ROLES.HEADQUARTERS || role === ROLES.SUPER_ADMIN) {
    return { role, scopeIds: [], scopeNames: [] }
  }

  if (role === ROLES.STORE) {
    const { data } = await supabase
      .from('store_members')
      .select('store_id, stores(store_name)')
      .eq('email', email)
    return {
      role,
      scopeIds: data?.map(r => r.store_id) ?? [],
      scopeNames: data?.map(r => r.stores?.store_name).filter(Boolean) ?? [],
    }
  }

  if (role === ROLES.AREA_MANAGER) {
    const { data } = await supabase
      .from('area_members')
      .select('area_id')
      .eq('email', email)
    return {
      role,
      scopeIds: data?.map(r => r.area_id) ?? [],
      scopeNames: [],
    }
  }

  if (role === ROLES.GROUP_MANAGER) {
    const { data } = await supabase
      .from('business_group_members')
      .select('business_group_id')
      .eq('email', email)
    return {
      role,
      scopeIds: data?.map(r => r.business_group_id) ?? [],
      scopeNames: [],
    }
  }

  return null
}

export async function getAccessibleStoreNames(roleInfo) {
  const { role, scopeIds, scopeNames } = roleInfo

  if (role === ROLES.SUPER_ADMIN || role === ROLES.HEADQUARTERS) {
    const { data } = await supabase.from('stores').select('store_name')
    return data?.map(s => s.store_name) ?? []
  }

  if (role === ROLES.GROUP_MANAGER) {
    const { data } = await supabase
      .from('stores')
      .select('store_name')
      .in('business_group_id', scopeIds)
    return data?.map(s => s.store_name) ?? []
  }

  if (role === ROLES.AREA_MANAGER) {
    const { data } = await supabase
      .from('stores')
      .select('store_name')
      .in('area_id', scopeIds)
    return data?.map(s => s.store_name) ?? []
  }

  if (role === ROLES.STORE) {
    return scopeNames ?? []
  }

  return []
}

export function canReply(role) {
  return [ROLES.STORE, ROLES.AREA_MANAGER, ROLES.GROUP_MANAGER, ROLES.SUPER_ADMIN].includes(role)
}

export function canClose(role) {
  return [ROLES.GROUP_MANAGER, ROLES.SUPER_ADMIN].includes(role)
}
