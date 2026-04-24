import { supabase } from '../lib/supabase.js'
import { ROLES } from '../lib/auth.js'
import { toast } from '../lib/toast.js'

export function renderAdmin(container, user, roleInfo) {
  if (roleInfo.role !== ROLES.SUPER_ADMIN) {
    container.innerHTML = `
      <div class="page-header"><h2>⚙️ 資料管理</h2></div>
      <div class="page-content">
        <div class="empty-state"><div class="icon">🔒</div><p>此頁面僅限最高管理員存取</p></div>
      </div>
    `
    return
  }

  container.innerHTML = `
    <div class="page-header"><h2>⚙️ 資料管理</h2></div>
    <div class="page-content">
      <div class="tabs">
        <button class="tab-btn active" data-tab="stores">門店管理</button>
        <button class="tab-btn" data-tab="areas">區域管理</button>
        <button class="tab-btn" data-tab="groups">品牌群組</button>
        <button class="tab-btn" data-tab="business">事業群</button>
        <button class="tab-btn" data-tab="users">使用者權限</button>
      </div>
      <div id="tab-content"></div>
    </div>
  `

  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'))
      btn.classList.add('active')
      loadTab(btn.dataset.tab)
    })
  })

  loadTab('stores')
}

async function loadTab(tab) {
  const content = document.getElementById('tab-content')
  content.innerHTML = '<div class="loading"><div class="spinner"></div> 載入中…</div>'
  const handlers = { stores, areas, groups, business, users }
  if (handlers[tab]) await handlers[tab](content)
}

// ── Stores ──────────────────────────────────────────────────────────────────
async function stores(content) {
  const [{ data: googleGroups }, { data: areaList }, { data: bgList }, { data: rows, error }] =
    await Promise.all([
      supabase.from('google_group').select('id, group_name'),
      supabase.from('areas').select('id, area_name'),
      supabase.from('business_groups').select('id, business_group_name'),
      supabase.from('stores').select(`
        id, store_name, group_id, area_id, business_group_id,
        google_group(id, group_name),
        areas(id, area_name),
        business_groups(id, business_group_name),
        store_managers(id, manager_name, manager_email)
      `).order('id'),
    ])

  if (error) { content.innerHTML = errHtml(error); return }

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-add-store">＋ 新增門店</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>門店名稱</th><th>品牌</th><th>區域</th><th>事業群</th><th>店長</th><th>操作</th>
        </tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${esc(r.store_name)}</td>
            <td>${esc(r.google_group?.group_name ?? '—')}</td>
            <td>${esc(r.areas?.area_name ?? '—')}</td>
            <td>${esc(r.business_groups?.business_group_name ?? '—')}</td>
            <td>${(r.store_managers ?? []).map(m => `<div>${esc(m.manager_name ?? '')} <span style="color:var(--gray-600);font-size:12px">${esc(m.manager_email)}</span></div>`).join('') || '—'}</td>
            <td><button class="btn btn-secondary btn-sm btn-edit-store" data-id="${r.id}">編輯</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `

  document.getElementById('btn-add-store').addEventListener('click', () =>
    storeModal(null, googleGroups, areaList, bgList))

  content.querySelectorAll('.btn-edit-store').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = rows.find(r => r.id == btn.dataset.id)
      storeModal(row, googleGroups, areaList, bgList)
    })
  })
}

function storeModal(row, googleGroups, areaList, bgList) {
  const isEdit = !!row
  let pendingManagers = (row?.store_managers ?? []).map(m => ({ ...m }))

  showModal(isEdit ? '編輯門店' : '新增門店', `
    <div class="form-group">
      <label class="form-label">門店名稱 *</label>
      <input class="form-input" id="m-store-name" value="${esc(row?.store_name ?? '')}" />
    </div>
    <div class="form-grid">
      <div class="form-group">
        <label class="form-label">品牌群組</label>
        <select class="form-input" id="m-group-id">
          <option value="">—</option>
          ${googleGroups.map(g => `<option value="${g.id}" ${row?.group_id == g.id ? 'selected' : ''}>${esc(g.group_name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">區域</label>
        <select class="form-input" id="m-area-id">
          <option value="">—</option>
          ${areaList.map(a => `<option value="${a.id}" ${row?.area_id == a.id ? 'selected' : ''}>${esc(a.area_name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">事業群</label>
        <select class="form-input" id="m-bg-id">
          <option value="">—</option>
          ${bgList.map(b => `<option value="${b.id}" ${row?.business_group_id == b.id ? 'selected' : ''}>${esc(b.business_group_name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">店長列表</label>
      <div id="mgr-list" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="new-mgr-name" placeholder="姓名" style="flex:1" />
        <input class="form-input" id="new-mgr-email" placeholder="信箱" type="email" style="flex:2" />
        <button class="btn btn-secondary btn-sm" id="btn-add-mgr" style="white-space:nowrap">新增</button>
      </div>
    </div>
  `, async () => {
    const name = document.getElementById('m-store-name').value.trim()
    if (!name) { toast('門店名稱必填', 'error'); return false }

    const payload = {
      store_name: name,
      group_id: document.getElementById('m-group-id').value || null,
      area_id: document.getElementById('m-area-id').value || null,
      business_group_id: document.getElementById('m-bg-id').value || null,
    }

    let storeId = row?.id
    if (isEdit) {
      const { error } = await supabase.from('stores').update(payload).eq('id', storeId)
      if (error) { toast('更新失敗：' + error.message, 'error'); return false }
    } else {
      const { data, error } = await supabase.from('stores').insert(payload).select('id').single()
      if (error) { toast('新增失敗：' + error.message, 'error'); return false }
      storeId = data.id
    }

    // Replace all managers
    await supabase.from('store_managers').delete().eq('store_id', storeId)
    if (pendingManagers.length > 0) {
      const { error } = await supabase.from('store_managers').insert(
        pendingManagers.map(m => ({ store_id: storeId, manager_name: m.manager_name || null, manager_email: m.manager_email }))
      )
      if (error) { toast('主管寫入失敗：' + error.message, 'error'); return false }
    }

    toast(isEdit ? '門店已更新' : '門店已新增', 'success')
    loadTab('stores')
  }, () => {
    // after modal render — wire up manager add/remove
    renderMgrList()

    document.getElementById('btn-add-mgr').addEventListener('click', () => {
      const email = document.getElementById('new-mgr-email').value.trim()
      if (!email) { toast('請填入信箱', 'error'); return }
      if (pendingManagers.some(m => m.manager_email === email)) { toast('此信箱已存在', 'error'); return }
      pendingManagers.push({
        manager_name: document.getElementById('new-mgr-name').value.trim(),
        manager_email: email,
      })
      document.getElementById('new-mgr-name').value = ''
      document.getElementById('new-mgr-email').value = ''
      renderMgrList()
    })
  })

  function renderMgrList() {
    document.getElementById('mgr-list').innerHTML = pendingManagers.length === 0
      ? '<div style="color:var(--gray-400);font-size:13px">尚未設定店長</div>'
      : pendingManagers.map((m, i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-100)">
            <span style="flex:1;font-size:13px">${esc(m.manager_name || '—')} <span style="color:var(--gray-600)">${esc(m.manager_email)}</span></span>
            <button class="btn btn-danger btn-sm btn-rm-mgr" data-idx="${i}" style="padding:2px 8px">移除</button>
          </div>`).join('')

    document.querySelectorAll('.btn-rm-mgr').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingManagers.splice(+btn.dataset.idx, 1)
        renderMgrList()
      })
    })
  }
}

// ── Areas ────────────────────────────────────────────────────────────────────
async function areas(content) {
  const { data: rows, error } = await supabase.from('areas').select(`
    id, area_name,
    area_managers(id, manager_name, manager_email)
  `).order('id')

  if (error) { content.innerHTML = errHtml(error); return }

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-add-area">＋ 新增區域</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>區域名稱</th><th>區域主管</th><th>操作</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(r.area_name)}</td>
        <td>${(r.area_managers ?? []).map(m => `<div>${esc(m.manager_name ?? '')} <span style="color:var(--gray-600);font-size:12px">${esc(m.manager_email)}</span></div>`).join('') || '—'}</td>
        <td><button class="btn btn-secondary btn-sm btn-edit-area" data-id="${r.id}">編輯</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  `

  document.getElementById('btn-add-area').addEventListener('click', () => areaModal(null))
  content.querySelectorAll('.btn-edit-area').forEach(btn => {
    btn.addEventListener('click', () => areaModal(rows.find(r => r.id == btn.dataset.id)))
  })
}

function areaModal(row) {
  const isEdit = !!row
  let pendingManagers = (row?.area_managers ?? []).map(m => ({ ...m }))

  showModal(isEdit ? '編輯區域' : '新增區域', `
    <div class="form-group">
      <label class="form-label">區域名稱 *</label>
      <input class="form-input" id="m-area-name" value="${esc(row?.area_name ?? '')}" />
    </div>
    <div class="form-group">
      <label class="form-label">區域主管列表</label>
      <div id="mgr-list" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="new-mgr-name" placeholder="姓名" style="flex:1" />
        <input class="form-input" id="new-mgr-email" placeholder="信箱" type="email" style="flex:2" />
        <button class="btn btn-secondary btn-sm" id="btn-add-mgr" style="white-space:nowrap">新增</button>
      </div>
    </div>
  `, async () => {
    const areaName = document.getElementById('m-area-name').value.trim()
    if (!areaName) { toast('區域名稱必填', 'error'); return false }

    let areaId = row?.id
    if (isEdit) {
      const { error } = await supabase.from('areas').update({ area_name: areaName }).eq('id', areaId)
      if (error) { toast('更新失敗：' + error.message, 'error'); return false }
    } else {
      const { data, error } = await supabase.from('areas').insert({ area_name: areaName }).select('id').single()
      if (error) { toast('新增失敗：' + error.message, 'error'); return false }
      areaId = data.id
    }

    await supabase.from('area_managers').delete().eq('area_id', areaId)
    if (pendingManagers.length > 0) {
      const { error } = await supabase.from('area_managers').insert(
        pendingManagers.map(m => ({ area_id: areaId, manager_name: m.manager_name || null, manager_email: m.manager_email }))
      )
      if (error) { toast('主管寫入失敗：' + error.message, 'error'); return false }
    }

    toast(isEdit ? '區域已更新' : '區域已新增', 'success')
    loadTab('areas')
  }, () => {
    renderMgrList()
    document.getElementById('btn-add-mgr').addEventListener('click', () => {
      const email = document.getElementById('new-mgr-email').value.trim()
      if (!email) { toast('請填入信箱', 'error'); return }
      if (pendingManagers.some(m => m.manager_email === email)) { toast('此信箱已存在', 'error'); return }
      pendingManagers.push({ manager_name: document.getElementById('new-mgr-name').value.trim(), manager_email: email })
      document.getElementById('new-mgr-name').value = ''
      document.getElementById('new-mgr-email').value = ''
      renderMgrList()
    })
  })

  function renderMgrList() {
    document.getElementById('mgr-list').innerHTML = pendingManagers.length === 0
      ? '<div style="color:var(--gray-400);font-size:13px">尚未設定主管</div>'
      : pendingManagers.map((m, i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-100)">
            <span style="flex:1;font-size:13px">${esc(m.manager_name || '—')} <span style="color:var(--gray-600)">${esc(m.manager_email)}</span></span>
            <button class="btn btn-danger btn-sm btn-rm-mgr" data-idx="${i}" style="padding:2px 8px">移除</button>
          </div>`).join('')

    document.querySelectorAll('.btn-rm-mgr').forEach(btn => {
      btn.addEventListener('click', () => { pendingManagers.splice(+btn.dataset.idx, 1); renderMgrList() })
    })
  }
}

// ── Google Groups ─────────────────────────────────────────────────────────────
async function groups(content) {
  const { data: rows, error } = await supabase.from('google_group').select('*').order('id')
  if (error) { content.innerHTML = errHtml(error); return }

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-add-group">＋ 新增品牌</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>品牌名稱</th><th>建立時間</th><th>操作</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${r.id}</td><td>${esc(r.group_name)}</td><td>${fmtDate(r.created_at)}</td>
        <td><button class="btn btn-secondary btn-sm btn-edit-group" data-id="${r.id}">編輯</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  `

  document.getElementById('btn-add-group').addEventListener('click', () => groupModal(null))
  content.querySelectorAll('.btn-edit-group').forEach(btn => {
    btn.addEventListener('click', () => groupModal(rows.find(r => r.id == btn.dataset.id)))
  })
}

function groupModal(row) {
  const isEdit = !!row
  showModal(isEdit ? '編輯品牌' : '新增品牌', `
    <div class="form-group">
      <label class="form-label">品牌名稱 *</label>
      <input class="form-input" id="m-group-name" value="${esc(row?.group_name ?? '')}" />
    </div>
  `, async () => {
    const name = document.getElementById('m-group-name').value.trim()
    if (!name) { toast('品牌名稱必填', 'error'); return false }
    const { error } = isEdit
      ? await supabase.from('google_group').update({ group_name: name }).eq('id', row.id)
      : await supabase.from('google_group').insert({ group_name: name })
    if (error) { toast('儲存失敗：' + error.message, 'error'); return false }
    toast(isEdit ? '品牌已更新' : '品牌已新增', 'success')
    loadTab('groups')
  })
}

// ── Business Groups ───────────────────────────────────────────────────────────
async function business(content) {
  const { data: rows, error } = await supabase.from('business_groups').select(`
    id, business_group_name,
    business_group_managers(id, manager_name, manager_email)
  `).order('id')

  if (error) { content.innerHTML = errHtml(error); return }

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-add-bg">＋ 新增事業群</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>事業群名稱</th><th>主管</th><th>操作</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(r.business_group_name)}</td>
        <td>${(r.business_group_managers ?? []).map(m => `<div>${esc(m.manager_name ?? '')} <span style="color:var(--gray-600);font-size:12px">${esc(m.manager_email)}</span></div>`).join('') || '—'}</td>
        <td><button class="btn btn-secondary btn-sm btn-edit-bg" data-id="${r.id}">編輯</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  `

  document.getElementById('btn-add-bg').addEventListener('click', () => bgModal(null))
  content.querySelectorAll('.btn-edit-bg').forEach(btn => {
    btn.addEventListener('click', () => bgModal(rows.find(r => r.id == btn.dataset.id)))
  })
}

function bgModal(row) {
  const isEdit = !!row
  let pendingManagers = (row?.business_group_managers ?? []).map(m => ({ ...m }))

  showModal(isEdit ? '編輯事業群' : '新增事業群', `
    <div class="form-group">
      <label class="form-label">事業群名稱 *</label>
      <input class="form-input" id="m-bg-name" value="${esc(row?.business_group_name ?? '')}" />
    </div>
    <div class="form-group">
      <label class="form-label">事業群主管列表</label>
      <div id="mgr-list" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="new-mgr-name" placeholder="姓名" style="flex:1" />
        <input class="form-input" id="new-mgr-email" placeholder="信箱" type="email" style="flex:2" />
        <button class="btn btn-secondary btn-sm" id="btn-add-mgr" style="white-space:nowrap">新增</button>
      </div>
    </div>
  `, async () => {
    const bgName = document.getElementById('m-bg-name').value.trim()
    if (!bgName) { toast('事業群名稱必填', 'error'); return false }

    let bgId = row?.id
    if (isEdit) {
      const { error } = await supabase.from('business_groups').update({ business_group_name: bgName }).eq('id', bgId)
      if (error) { toast('更新失敗：' + error.message, 'error'); return false }
    } else {
      const { data, error } = await supabase.from('business_groups').insert({ business_group_name: bgName }).select('id').single()
      if (error) { toast('新增失敗：' + error.message, 'error'); return false }
      bgId = data.id
    }

    await supabase.from('business_group_managers').delete().eq('business_group_id', bgId)
    if (pendingManagers.length > 0) {
      const { error } = await supabase.from('business_group_managers').insert(
        pendingManagers.map(m => ({ business_group_id: bgId, manager_name: m.manager_name || null, manager_email: m.manager_email }))
      )
      if (error) { toast('主管寫入失敗：' + error.message, 'error'); return false }
    }

    toast(isEdit ? '事業群已更新' : '事業群已新增', 'success')
    loadTab('business')
  }, () => {
    renderMgrList()
    document.getElementById('btn-add-mgr').addEventListener('click', () => {
      const email = document.getElementById('new-mgr-email').value.trim()
      if (!email) { toast('請填入信箱', 'error'); return }
      if (pendingManagers.some(m => m.manager_email === email)) { toast('此信箱已存在', 'error'); return }
      pendingManagers.push({ manager_name: document.getElementById('new-mgr-name').value.trim(), manager_email: email })
      document.getElementById('new-mgr-name').value = ''
      document.getElementById('new-mgr-email').value = ''
      renderMgrList()
    })
  })

  function renderMgrList() {
    document.getElementById('mgr-list').innerHTML = pendingManagers.length === 0
      ? '<div style="color:var(--gray-400);font-size:13px">尚未設定主管</div>'
      : pendingManagers.map((m, i) => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--gray-100)">
            <span style="flex:1;font-size:13px">${esc(m.manager_name || '—')} <span style="color:var(--gray-600)">${esc(m.manager_email)}</span></span>
            <button class="btn btn-danger btn-sm btn-rm-mgr" data-idx="${i}" style="padding:2px 8px">移除</button>
          </div>`).join('')

    document.querySelectorAll('.btn-rm-mgr').forEach(btn => {
      btn.addEventListener('click', () => { pendingManagers.splice(+btn.dataset.idx, 1); renderMgrList() })
    })
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function users(content) {
  const { data: rows, error } = await supabase.from('user_roles').select('*').order('id')
  if (error) { content.innerHTML = errHtml(error); return }

  content.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
      <button class="btn btn-primary" id="btn-add-user">＋ 新增帳號</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>信箱</th><th>角色</th><th>建立時間</th><th>操作</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${esc(r.email)}</td><td>${esc(r.role)}</td><td>${fmtDate(r.created_at)}</td>
        <td>
          <button class="btn btn-secondary btn-sm btn-edit-user" data-id="${r.id}">編輯</button>
          <button class="btn btn-danger btn-sm btn-del-user" data-id="${r.id}" style="margin-left:4px">刪除</button>
        </td>
      </tr>`).join('')}</tbody>
    </table></div>
  `

  document.getElementById('btn-add-user').addEventListener('click', () => userModal(null))
  content.querySelectorAll('.btn-edit-user').forEach(btn =>
    btn.addEventListener('click', () => userModal(rows.find(r => r.id == btn.dataset.id))))
  content.querySelectorAll('.btn-del-user').forEach(btn =>
    btn.addEventListener('click', async () => {
      if (!confirm('確定要刪除此帳號？')) return
      const { error } = await supabase.from('user_roles').delete().eq('id', btn.dataset.id)
      if (error) toast('刪除失敗：' + error.message, 'error')
      else { toast('帳號已刪除', 'success'); loadTab('users') }
    }))
}

function userModal(row) {
  const isEdit = !!row
  showModal(isEdit ? '編輯帳號' : '新增帳號', `
    <div class="form-group">
      <label class="form-label">信箱 *</label>
      <input class="form-input" id="m-email" type="email" value="${esc(row?.email ?? '')}" ${isEdit ? 'readonly style="background:var(--gray-100)"' : ''} />
    </div>
    <div class="form-group">
      <label class="form-label">角色 *</label>
      <select class="form-input" id="m-role">
        <option value="headquarters" ${row?.role === 'headquarters' ? 'selected' : ''}>總部 (headquarters)</option>
        <option value="super_admin" ${row?.role === 'super_admin' ? 'selected' : ''}>最高管理員 (super_admin)</option>
      </select>
    </div>
  `, async () => {
    const payload = {
      email: document.getElementById('m-email').value.trim(),
      role: document.getElementById('m-role').value,
      updated_at: new Date().toISOString(),
    }
    if (!payload.email) { toast('信箱必填', 'error'); return false }
    const { error } = isEdit
      ? await supabase.from('user_roles').update(payload).eq('id', row.id)
      : await supabase.from('user_roles').insert(payload)
    if (error) { toast('儲存失敗：' + error.message, 'error'); return false }
    toast(isEdit ? '帳號已更新' : '帳號已新增', 'success')
    loadTab('users')
  })
}

// ── Shared modal ──────────────────────────────────────────────────────────────
function showModal(title, bodyHtml, onSave, onAfterRender) {
  const backdrop = document.createElement('div')
  backdrop.className = 'modal-backdrop'
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn-close" id="modal-close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="modal-cancel">取消</button>
        <button class="btn btn-primary" id="modal-save">儲存</button>
      </div>
    </div>
  `
  document.body.appendChild(backdrop)
  const close = () => backdrop.remove()
  document.getElementById('modal-close').addEventListener('click', close)
  document.getElementById('modal-cancel').addEventListener('click', close)
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close() })
  document.getElementById('modal-save').addEventListener('click', async () => {
    const result = await onSave()
    if (result !== false) close()
  })
  if (onAfterRender) onAfterRender()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

function errHtml(error) {
  return `<div class="empty-state"><div class="icon">⚠️</div><p>載入失敗：${error.message}</p></div>`
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
