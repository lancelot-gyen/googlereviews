import { supabase } from './supabase.js'

export const ROLES = {
  STORE: 'store',
  AREA_MANAGER: 'area_manager',
  GROUP_MANAGER: 'group_manager',
  HEADQUARTERS: 'headquarters',
  SUPER_ADMIN: 'super_admin',
}

export const ROLE_LABELS = {
  store: '門店店長',
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

export async function resolveRole(email) {
  // headquarters / super_admin — maintained in user_roles
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('email', email)
    .single()

  if (userRole) return { role: userRole.role, scopeIds: [], scopeNames: [] }

  // group_manager — business_group_managers
  const { data: bgmList } = await supabase
    .from('business_group_managers')
    .select('business_group_id')
    .eq('manager_email', email)

  if (bgmList && bgmList.length > 0) {
    return {
      role: ROLES.GROUP_MANAGER,
      scopeIds: bgmList.map(r => r.business_group_id),
      scopeNames: [],
    }
  }

  // area_manager — area_managers
  const { data: amList } = await supabase
    .from('area_managers')
    .select('area_id')
    .eq('manager_email', email)

  if (amList && amList.length > 0) {
    return {
      role: ROLES.AREA_MANAGER,
      scopeIds: amList.map(r => r.area_id),
      scopeNames: [],
    }
  }

  // store — store_managers
  const { data: smList } = await supabase
    .from('store_managers')
    .select('store_id, stores(store_name)')
    .eq('manager_email', email)

  if (smList && smList.length > 0) {
    return {
      role: ROLES.STORE,
      scopeIds: smList.map(r => r.store_id),
      scopeNames: smList.map(r => r.stores?.store_name).filter(Boolean),
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
