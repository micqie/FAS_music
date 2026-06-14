/* =============================================================
   admin_audit_logs.js
   ============================================================= */

// ── State ──────────────────────────────────────────────────────────
let auditCurrentPage  = 1;
let auditPerPage      = 50;
let auditTotalPages   = 1;
let auditFilters      = { module: '', severity: '', search: '', date_from: '', date_to: '' };
let auditRefreshTimer = null;

// ── Helpers ────────────────────────────────────────────────────────
function escapeHtml(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDateTime(v) {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit'
    });
}

function severityBadge(s) {
    const map = {
        info:     'bg-blue-100 text-blue-700',
        warning:  'bg-amber-100 text-amber-700',
        critical: 'bg-red-100 text-red-700'
    };
    const icon = { info: 'fa-circle-info', warning: 'fa-triangle-exclamation', critical: 'fa-circle-xmark' };
    const cls = map[s] || 'bg-slate-100 text-slate-600';
    return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}">
        <i class="fas ${icon[s] || 'fa-circle'} text-[10px]"></i>${escapeHtml(s || 'info')}
    </span>`;
}

function moduleBadge(m) {
    const colors = {
        'Students':      'bg-purple-100 text-purple-700',
        'Teachers':      'bg-indigo-100 text-indigo-700',
        'Enrollments':   'bg-sky-100 text-sky-700',
        'Payments':      'bg-emerald-100 text-emerald-700',
        'Users':         'bg-orange-100 text-orange-700',
        'Registrations': 'bg-pink-100 text-pink-700',
        'Sessions':      'bg-teal-100 text-teal-700',
        'General':       'bg-slate-100 text-slate-600'
    };
    const cls = colors[m] || 'bg-slate-100 text-slate-600';
    return `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}">${escapeHtml(m || '—')}</span>`;
}

// ── Load stats ─────────────────────────────────────────────────────
async function loadAuditStats() {
    try {
        const res  = await axios.get(`${baseApiUrl}/audit_logs.php?action=get-stats`);
        const data = res.data?.stats || {};
        document.getElementById('auditStatTotal').textContent    = Number(data.total_logs    || 0).toLocaleString();
        document.getElementById('auditStatToday').textContent    = Number(data.today_count   || 0).toLocaleString();
        document.getElementById('auditStatWarning').textContent  = Number(data.warning_count || 0).toLocaleString();
        document.getElementById('auditStatCritical').textContent = Number(data.critical_count|| 0).toLocaleString();
    } catch(e) { /* silent */ }
}

// ── Load module filter options ─────────────────────────────────────
async function loadAuditModules() {
    try {
        const res = await axios.get(`${baseApiUrl}/audit_logs.php?action=get-modules`);
        const mods = res.data?.modules || [];
        const sel  = document.getElementById('auditFilterModule');
        if (!sel) return;
        sel.innerHTML = '<option value="">All Modules</option>' +
            mods.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
        if (auditFilters.module) sel.value = auditFilters.module;
    } catch(e) { /* silent */ }
}

// ── Load logs table ────────────────────────────────────────────────
async function loadAuditLogs(page = 1) {
    auditCurrentPage = page;

    const params = new URLSearchParams({
        action:   'get-logs',
        page:     String(page),
        per_page: String(auditPerPage),
        ...Object.fromEntries(Object.entries(auditFilters).filter(([,v]) => v !== ''))
    });

    const tbody   = document.getElementById('auditLogsTbody');
    const countEl = document.getElementById('auditLogCount');
    const pager   = document.getElementById('auditPagination');

    if (tbody) tbody.innerHTML = `
        <tr><td colspan="7" class="px-6 py-10 text-center text-slate-400 text-sm">
            <i class="fas fa-spinner fa-spin mr-2"></i>Loading logs…
        </td></tr>`;

    try {
        const res  = await axios.get(`${baseApiUrl}/audit_logs.php?${params}`);
        const data = res.data || {};

        if (!data.success) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500 text-sm">${escapeHtml(data.error || 'Failed to load logs.')}</td></tr>`;
            return;
        }

        auditTotalPages = data.total_pages || 1;
        const total = data.total || 0;
        if (countEl) countEl.textContent = `${total.toLocaleString()} log${total === 1 ? '' : 's'}`;

        if (tbody) {
            if (!data.logs?.length) {
                tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400">
                    <div class="flex flex-col items-center gap-3">
                        <i class="fas fa-clipboard-list text-3xl text-slate-200"></i>
                        <p class="font-semibold">No audit logs found</p>
                        <p class="text-xs text-slate-400">Try adjusting the filters or date range.</p>
                    </div>
                </td></tr>`;
            } else {
                tbody.innerHTML = data.logs.map(log => {
                    const hasSnapshot = log.old_value || log.new_value;
                    return `
                    <tr class="border-b border-slate-100 hover:bg-slate-50 transition group audit-row"
                        data-log='${escapeHtml(JSON.stringify(log))}'>
                        <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">${escapeHtml(formatDateTime(log.created_at))}</td>
                        <td class="px-4 py-3">${severityBadge(log.severity)}</td>
                        <td class="px-4 py-3">${moduleBadge(log.module)}</td>
                        <td class="px-4 py-3 text-sm font-semibold text-slate-800 max-w-[160px] truncate">${escapeHtml(log.action || '—')}</td>
                        <td class="px-4 py-3 text-sm text-slate-600 max-w-[240px] truncate" title="${escapeHtml(log.description || '')}">${escapeHtml(log.description || '—')}</td>
                        <td class="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                            <div class="font-medium text-slate-800">${escapeHtml(log.user_name || '—')}</div>
                            ${log.user_role ? `<div class="text-[11px] text-slate-400 uppercase tracking-wide">${escapeHtml(log.user_role)}</div>` : ''}
                        </td>
                        <td class="px-4 py-3 text-center">
                            <button type="button" class="audit-detail-btn text-gold-500 hover:text-gold-600 text-sm transition"
                                title="View details" data-log='${escapeHtml(JSON.stringify(log))}'>
                                <i class="fas fa-eye"></i>
                            </button>
                            ${hasSnapshot ? `<span class="ml-2 px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-500">DIFF</span>` : ''}
                        </td>
                    </tr>`;
                }).join('');

                // Bind detail buttons
                document.querySelectorAll('.audit-detail-btn').forEach(btn => {
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        openAuditDetail(JSON.parse(btn.dataset.log));
                    });
                });

                // Row click also opens detail
                document.querySelectorAll('.audit-row').forEach(row => {
                    row.style.cursor = 'pointer';
                    row.addEventListener('click', () => openAuditDetail(JSON.parse(row.dataset.log)));
                });
            }
        }

        renderAuditPagination(page, auditTotalPages, total);

    } catch(e) {
        console.error('Audit log load error:', e);
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500 text-sm">Network error while loading logs.</td></tr>`;
    }
}

// ── Pagination ─────────────────────────────────────────────────────
function renderAuditPagination(current, total, totalRows) {
    const pager = document.getElementById('auditPagination');
    if (!pager) return;
    if (total <= 1) { pager.innerHTML = ''; return; }

    const pages = [];
    if (total <= 7) {
        for (let i = 1; i <= total; i++) pages.push(i);
    } else {
        pages.push(1);
        if (current > 3) pages.push('…');
        for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
        if (current < total - 2) pages.push('…');
        pages.push(total);
    }

    pager.innerHTML = `
        <button onclick="loadAuditLogs(${current - 1})" ${current === 1 ? 'disabled' : ''}
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition">
            <i class="fas fa-chevron-left text-xs"></i>
        </button>
        ${pages.map(p => p === '…'
            ? `<span class="px-2 py-1.5 text-slate-400 text-sm">…</span>`
            : `<button onclick="loadAuditLogs(${p})"
                class="px-3 py-1.5 rounded-lg border text-sm transition ${p === current
                    ? 'bg-obsidian text-white border-obsidian font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-100'}">${p}</button>`
        ).join('')}
        <button onclick="loadAuditLogs(${current + 1})" ${current === total ? 'disabled' : ''}
            class="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition">
            <i class="fas fa-chevron-right text-xs"></i>
        </button>`;
}

// ── Detail modal ───────────────────────────────────────────────────
function openAuditDetail(log) {
    const modal    = document.getElementById('auditDetailModal');
    const content  = document.getElementById('auditDetailContent');
    if (!modal || !content) return;

    const fmtJson = (val) => {
        if (!val || typeof val !== 'object') return null;
        return JSON.stringify(val, null, 2);
    };

    const oldJson = fmtJson(log.old_value);
    const newJson = fmtJson(log.new_value);

    content.innerHTML = `
        <div class="space-y-4 text-sm">

            <!-- Header strip -->
            <div class="rounded-2xl p-4 flex items-start gap-4" style="background: linear-gradient(135deg,#0b0f18,#1a1d23);">
                <div class="h-11 w-11 rounded-2xl bg-gold-500/20 flex items-center justify-center shrink-0">
                    <i class="fas fa-clipboard-list text-gold-400 text-lg"></i>
                </div>
                <div class="min-w-0 text-white">
                    <p class="text-[10px] uppercase tracking-widest text-gold-400 font-bold mb-0.5">Audit Entry #${escapeHtml(String(log.log_id))}</p>
                    <p class="text-lg font-black truncate">${escapeHtml(log.action || '—')}</p>
                    <p class="text-sm text-slate-300 mt-0.5">${escapeHtml(formatDateTime(log.created_at))}</p>
                </div>
            </div>

            <!-- Info grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Severity</p>
                    <div>${severityBadge(log.severity)}</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Module</p>
                    <div>${moduleBadge(log.module)}</div>
                </div>
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">User</p>
                    <p class="font-semibold text-slate-800">${escapeHtml(log.user_name || '—')}</p>
                    ${log.user_role ? `<p class="text-[11px] text-slate-400 uppercase tracking-wide">${escapeHtml(log.user_role)}</p>` : ''}
                </div>
                ${log.target_type ? `
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Target</p>
                    <p class="font-semibold text-slate-800">${escapeHtml(log.target_type)} ${log.target_id ? '#' + log.target_id : ''}</p>
                    ${log.target_label ? `<p class="text-[11px] text-slate-500">${escapeHtml(log.target_label)}</p>` : ''}
                </div>` : ''}
                ${log.ip_address ? `
                <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">IP Address</p>
                    <p class="font-mono text-slate-700 text-xs">${escapeHtml(log.ip_address)}</p>
                </div>` : ''}
            </div>

            <!-- Description -->
            ${log.description ? `
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Description</p>
                <p class="text-slate-700 leading-relaxed">${escapeHtml(log.description)}</p>
            </div>` : ''}

            <!-- Before / After snapshots -->
            ${oldJson || newJson ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${oldJson ? `
                <div class="rounded-xl border border-rose-200 bg-rose-50/60 overflow-hidden">
                    <p class="px-3 py-2 text-[10px] uppercase tracking-widest text-rose-600 font-bold border-b border-rose-200">
                        <i class="fas fa-minus-circle mr-1"></i>Before
                    </p>
                    <pre class="px-3 py-3 text-xs text-rose-800 overflow-auto max-h-48 font-mono leading-relaxed">${escapeHtml(oldJson)}</pre>
                </div>` : ''}
                ${newJson ? `
                <div class="rounded-xl border border-emerald-200 bg-emerald-50/60 overflow-hidden">
                    <p class="px-3 py-2 text-[10px] uppercase tracking-widest text-emerald-700 font-bold border-b border-emerald-200">
                        <i class="fas fa-plus-circle mr-1"></i>After
                    </p>
                    <pre class="px-3 py-3 text-xs text-emerald-800 overflow-auto max-h-48 font-mono leading-relaxed">${escapeHtml(newJson)}</pre>
                </div>` : ''}
            </div>` : ''}

        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeAuditDetail() {
    const modal = document.getElementById('auditDetailModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

// ── CSV export ─────────────────────────────────────────────────────
async function exportAuditCSV() {
    const params = new URLSearchParams({
        action:   'get-logs',
        page:     '1',
        per_page: '5000',
        ...Object.fromEntries(Object.entries(auditFilters).filter(([,v]) => v !== ''))
    });
    try {
        const res  = await axios.get(`${baseApiUrl}/audit_logs.php?${params}`);
        const logs = res.data?.logs || [];
        if (!logs.length) { alert('No logs to export.'); return; }

        const headers = ['Log ID','Date/Time','Severity','Module','Action','Description','User','Role','Target','IP'];
        const rows = logs.map(l => [
            l.log_id,
            formatDateTime(l.created_at),
            l.severity,
            l.module,
            l.action,
            (l.description || '').replace(/"/g,'""'),
            l.user_name || '',
            l.user_role || '',
            l.target_label || (l.target_type ? `${l.target_type} #${l.target_id}` : ''),
            l.ip_address || ''
        ].map(v => `"${v}"`).join(','));

        const csv  = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    } catch(e) {
        alert('Failed to export logs.');
    }
}

// ── Apply filters ──────────────────────────────────────────────────
function applyAuditFilters() {
    auditFilters.module    = document.getElementById('auditFilterModule')?.value    || '';
    auditFilters.severity  = document.getElementById('auditFilterSeverity')?.value  || '';
    auditFilters.search    = document.getElementById('auditSearch')?.value.trim()   || '';
    auditFilters.date_from = document.getElementById('auditDateFrom')?.value        || '';
    auditFilters.date_to   = document.getElementById('auditDateTo')?.value          || '';
    loadAuditLogs(1);
}

function clearAuditFilters() {
    ['auditFilterModule','auditFilterSeverity','auditSearch','auditDateFrom','auditDateTo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    auditFilters = { module: '', severity: '', search: '', date_from: '', date_to: '' };
    loadAuditLogs(1);
}

// ── Auto-refresh toggle ────────────────────────────────────────────
function toggleAuditAutoRefresh() {
    const btn = document.getElementById('auditAutoRefreshBtn');
    if (auditRefreshTimer) {
        clearInterval(auditRefreshTimer);
        auditRefreshTimer = null;
        if (btn) { btn.innerHTML = '<i class="fas fa-sync-alt mr-1.5"></i>Auto Refresh: Off'; btn.classList.replace('bg-emerald-600','bg-slate-700'); }
    } else {
        auditRefreshTimer = setInterval(() => { loadAuditLogs(auditCurrentPage); loadAuditStats(); }, 30000);
        if (btn) { btn.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-1.5"></i>Auto Refresh: 30s'; btn.classList.replace('bg-slate-700','bg-emerald-600'); }
    }
}

// ── Init ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Auth check
    if (typeof Auth !== 'undefined' && Auth.getUser) {
        const user = Auth.getUser();
        if (!user) { window.location.href = '../../index.html'; return; }
        const nameEl = document.getElementById('userNameNav');
        const menuEl = document.getElementById('profileMenuName');
        const display = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'Administrator';
        if (nameEl) nameEl.textContent = display;
        if (menuEl) menuEl.textContent = display;
    }

    await Promise.all([loadAuditStats(), loadAuditModules()]);
    await loadAuditLogs(1);

    // Filter bindings
    document.getElementById('auditFilterModule')?.addEventListener('change',   applyAuditFilters);
    document.getElementById('auditFilterSeverity')?.addEventListener('change', applyAuditFilters);
    document.getElementById('auditDateFrom')?.addEventListener('change',       applyAuditFilters);
    document.getElementById('auditDateTo')?.addEventListener('change',         applyAuditFilters);
    document.getElementById('auditSearch')?.addEventListener('input', () => {
        clearTimeout(window._auditSearchTimer);
        window._auditSearchTimer = setTimeout(applyAuditFilters, 400);
    });
    document.getElementById('auditClearFilters')?.addEventListener('click', clearAuditFilters);
    document.getElementById('auditExportBtn')?.addEventListener('click',    exportAuditCSV);
    document.getElementById('auditAutoRefreshBtn')?.addEventListener('click', toggleAuditAutoRefresh);
    document.getElementById('auditDetailCloseBtn')?.addEventListener('click', closeAuditDetail);
    document.getElementById('auditDetailOverlay')?.addEventListener('click',  closeAuditDetail);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAuditDetail(); });

    // Seed test data button
    document.getElementById('auditSeedBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('auditSeedBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1.5"></i>Seeding…'; }
        try {
            const res  = await axios.get(`${baseApiUrl}/audit_logs.php?action=seed`);
            const data = res.data || {};
            if (data.success) {
                await Promise.all([loadAuditStats(), loadAuditModules()]);
                await loadAuditLogs(1);
                // Show inline success
                const hdr = document.querySelector('h1');
                const note = document.createElement('p');
                note.className = 'text-xs text-emerald-600 font-semibold mt-1';
                note.textContent = '✅ ' + (data.message || 'Test data inserted.');
                hdr?.parentElement?.appendChild(note);
                setTimeout(() => note.remove(), 4000);
            } else {
                alert(data.error || 'Seed failed.');
            }
        } catch (e) {
            alert('Network error while seeding.');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-flask mr-1.5"></i>Seed Test Data'; }
        }
    });
});
