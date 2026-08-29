let learningMaterials = [];
let materialRequests = [];
const lmApi = `${baseApiUrl}/learning_materials.php`;
const instruments = ['General','Piano','Guitar','Bass Guitar','Ukulele','Violin','Voice','Drums','Cello','Flute','Saxophone'];
const levels = Array.from({ length: 10 }, (_, i) => `Level ${i + 1}`);
const lmEsc = value => { const el = document.createElement('div'); el.textContent = String(value ?? ''); return el.innerHTML; };
const lmEl = id => document.getElementById(id);
const lmToast = (icon, title) => Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true
});

function lmFillSelect(id, values) {
    const select = lmEl(id);
    if (select) select.innerHTML = '<option value="">Select</option>' + values.map(value => `<option>${lmEsc(value)}</option>`).join('');
}

function lmOpen(row = null) {
    const modal = lmEl('materialModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lmEl('materialModalTitle').textContent = row ? 'Edit Material' : 'Add Material';
    lmEl('materialId').value = row?.material_id || '';
    lmEl('materialName').value = row?.material_name || '';
    lmEl('materialInstrument').value = row?.instrument_type || '';
    lmEl('materialLevel').value = row?.level_name || '';
    lmEl('materialDescription').value = row?.description || '';
    lmEl('materialFile').value = '';
    lmEl('currentMaterialFile').textContent = row?.original_filename ? `Current file: ${row.original_filename}` : 'No file uploaded.';
    lmEl('deleteMaterialBtn')?.classList.toggle('hidden', !row);
}

function lmClose() {
    lmEl('materialModal')?.classList.add('hidden');
    lmEl('materialModal')?.classList.remove('flex');
    lmEl('materialForm')?.reset();
}

function lmRender() {
    const term = (lmEl('materialSearch')?.value || '').trim().toLowerCase();
    const status = lmEl('materialStatusFilter')?.value || 'All';
    const rows = learningMaterials.filter(row =>
        (status === 'All' || row.status === status) &&
        (!term || [row.material_name,row.instrument_type,row.level_name,row.description].join(' ').toLowerCase().includes(term))
    );
    lmEl('activeMaterialCount').textContent = String(learningMaterials.filter(row => row.status === 'Active').length);
    lmEl('archivedMaterialCount').textContent = String(learningMaterials.filter(row => row.status !== 'Active').length);
    const body = lmEl('materialsBody');
    if (!body) return;
    if (!rows.length) {
        body.innerHTML = '<tr><td colspan="5" class="px-5 py-10 text-center text-sm text-slate-500">No materials match this filter.</td></tr>';
        return;
    }
    body.innerHTML = rows.map(row => `<tr class="hover:bg-slate-50"><td class="px-5 py-4"><div class="font-bold text-slate-900">${lmEsc(row.material_name)}</div><div class="mt-1 max-w-sm truncate text-xs text-slate-500">${lmEsc(row.description || 'No description')}</div></td><td class="px-5 py-4"><span class="rounded-lg bg-gold-50 px-2.5 py-1 text-xs font-bold text-gold-600">${lmEsc(row.instrument_type)}</span><div class="mt-1 text-xs text-slate-500">${lmEsc(row.level_name)}</div></td><td class="px-5 py-4 text-sm">${row.file_path ? `<a class="font-semibold text-blue-600 hover:underline" target="_blank" href="../../${lmEsc(row.file_path)}"><i class="fas fa-file-arrow-down mr-1"></i>${lmEsc(row.original_filename || 'Open file')}</a>` : '<span class="text-xs text-slate-400">No file</span>'}</td><td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${row.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">${row.status === 'Active' ? 'Unarchived' : 'Archived'}</span></td><td class="px-5 py-4"><div class="flex justify-end gap-2"><button onclick="lmEdit(${row.material_id})" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Edit</button><button onclick="lmToggle(${row.material_id},'${row.status === 'Active' ? 'Inactive' : 'Active'}')" class="rounded-lg ${row.status === 'Active' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-700'} px-3 py-2 text-xs font-bold">${row.status === 'Active' ? 'Archive' : 'Unarchive'}</button><button onclick="lmDelete(${row.material_id})" class="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">Delete</button></div></td></tr>`).join('');
}

async function lmLoad() {
    const response = await axios.get(`${lmApi}?action=list`);
    learningMaterials = response.data?.materials || [];
    lmRender();
}

function lmRenderRequests() {
    const pendingCount = materialRequests.filter(row => row.status === 'Pending').length;
    if (lmEl('pendingRequestCount')) lmEl('pendingRequestCount').textContent = String(pendingCount);
    lmEl('requestsTabCount').textContent = String(pendingCount);
    const body = lmEl('materialRequestsBody');
    if (!body) return;
    if (!materialRequests.length) {
        body.innerHTML = '<tr><td colspan="5" class="px-5 py-8 text-center text-sm text-slate-500">No instructor requests yet.</td></tr>';
        return;
    }
    body.innerHTML = materialRequests.map(row => `<tr><td class="px-5 py-4"><div class="font-bold text-slate-900">${lmEsc(row.instructor_name)}</div><div class="text-xs text-slate-400">${new Date(row.created_at).toLocaleDateString('en-PH')}</div></td><td class="px-5 py-4"><div class="font-semibold">${lmEsc(row.material_name)}</div><div class="mt-1 text-xs text-slate-500">${lmEsc(row.instrument_type)} · ${lmEsc(row.level_name)}</div></td><td class="max-w-xs px-5 py-4 text-sm text-slate-600">${lmEsc(row.request_reason || 'No reason provided.')}</td><td class="px-5 py-4"><span class="rounded-full px-2.5 py-1 text-xs font-bold ${row.status === 'Pending' ? 'bg-amber-100 text-amber-700' : row.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${lmEsc(row.status)}</span></td><td class="px-5 py-4"><div class="flex justify-end gap-2">${row.status === 'Pending' ? `<button onclick="lmReviewRequest(${row.request_id},'Approved')" class="rounded-lg bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-700">Approve</button><button onclick="lmReviewRequest(${row.request_id},'Rejected')" class="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600">Reject</button>` : '<span class="text-xs text-slate-400">Reviewed</span>'}</div></td></tr>`).join('');
}

function lmShowView(view) {
    const showRequests = view === 'requests';
    lmEl('materialsOverview')?.classList.toggle('hidden', showRequests);
    lmEl('materialsView')?.classList.toggle('hidden', showRequests);
    lmEl('requestsView')?.classList.toggle('hidden', !showRequests);
    const materialsTab = lmEl('materialsViewTab');
    const requestsTab = lmEl('requestsViewTab');
    materialsTab?.classList.toggle('bg-slate-900', !showRequests);
    materialsTab?.classList.toggle('text-white', !showRequests);
    materialsTab?.classList.toggle('text-slate-500', showRequests);
    requestsTab?.classList.toggle('bg-slate-900', showRequests);
    requestsTab?.classList.toggle('text-white', showRequests);
    requestsTab?.classList.toggle('text-slate-500', !showRequests);
    materialsTab?.setAttribute('aria-selected', String(!showRequests));
    requestsTab?.setAttribute('aria-selected', String(showRequests));
}

async function lmLoadRequests() {
    const response = await axios.get(`${lmApi}?action=requests`);
    materialRequests = response.data?.requests || [];
    lmRenderRequests();
}

window.lmEdit = id => lmOpen(learningMaterials.find(row => Number(row.material_id) === Number(id)) || null);
window.lmToggle = async (id, status) => {
    await axios.post(`${lmApi}?action=status`, { material_id: id, status });
    await lmLoad();
    lmToast('success', status === 'Active' ? 'Material unarchived' : 'Material archived');
};
window.lmDelete = async id => {
    const result = await Swal.fire({ title: 'Delete material permanently?', text: 'Use Archive if you may need it again.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#be123c' });
    if (!result.isConfirmed) return;
    await axios.post(`${lmApi}?action=delete`, { material_id: id });
    lmClose();
    await lmLoad();
};
window.lmReviewRequest = async (id, decision) => {
    const result = await Swal.fire({ title: `${decision} this request?`, input: 'textarea', inputLabel: 'Review note (optional)', showCancelButton: true, confirmButtonText: decision, confirmButtonColor: decision === 'Approved' ? '#047857' : '#be123c' });
    if (!result.isConfirmed) return;
    await axios.post(`${lmApi}?action=review-request`, { request_id: id, decision, review_notes: result.value || '' });
    await Promise.all([lmLoad(), lmLoadRequests()]);
};

document.addEventListener('DOMContentLoaded', async () => {
    lmFillSelect('materialInstrument', instruments);
    lmFillSelect('materialLevel', levels);
    lmEl('addMaterialBtn')?.addEventListener('click', () => lmOpen());
    lmEl('closeMaterialModal')?.addEventListener('click', lmClose);
    lmEl('cancelMaterialModal')?.addEventListener('click', lmClose);
    lmEl('materialSearch')?.addEventListener('input', lmRender);
    lmEl('materialStatusFilter')?.addEventListener('change', lmRender);
    lmEl('materialsViewTab')?.addEventListener('click', () => lmShowView('materials'));
    lmEl('requestsViewTab')?.addEventListener('click', () => lmShowView('requests'));
    lmEl('deleteMaterialBtn')?.addEventListener('click', () => { const id = Number(lmEl('materialId')?.value || 0); if (id) lmDelete(id); });
    lmEl('materialForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        try {
            const isNewMaterial = !Number(lmEl('materialId')?.value || 0);
            const payload = new FormData(event.target);
            const response = await axios.post(`${lmApi}?action=save`, payload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (!response.data?.success) throw new Error(response.data?.error || 'The material could not be saved.');
            lmClose();
            if (isNewMaterial) {
                if (lmEl('materialStatusFilter')) lmEl('materialStatusFilter').value = 'Active';
                if (lmEl('materialSearch')) lmEl('materialSearch').value = '';
                lmShowView('materials');
            }
            await lmLoad();
            lmToast('success', isNewMaterial ? 'Material added' : 'Material updated');
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Unable to save', text: error.response?.data?.error || error.message });
        }
    });
    try { await Promise.all([lmLoad(), lmLoadRequests()]); }
    catch (error) { Swal.fire({ icon: 'error', title: 'Unable to load learning materials', text: error.response?.data?.error || error.message }); }
});
