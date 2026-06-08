function initManagerFeaturedPosts() {
    const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
    const role = String(user?.role_name || '').toLowerCase();
    const allowedRoles = ['staff', 'desk', 'front desk', 'manager', 'branch manager', 'admin'];
    const pageRole = String(document.body?.dataset?.featuredPostsRole || 'manager').toLowerCase();
    const roleLabel = pageRole === 'desk' ? 'Desk Staff' : 'Branch Manager';
    const studioLabel = pageRole === 'desk' ? 'Desk Content Studio' : 'Featured Content Studio';
    const pageTitleLabel = pageRole === 'desk' ? 'Desk Featured Posts' : 'Featured Posts';
    const listScope = pageRole === 'desk' ? 'desk' : 'manager';

    if (!user || !allowedRoles.includes(role)) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'error',
                title: 'Access Denied',
                text: 'You do not have access to featured post management.'
            }).finally(() => {
                window.location.href = '../../index.html';
            });
        } else {
            window.location.href = '../../index.html';
        }
        return;
    }

    const editorForm = document.getElementById('featuredPostForm');
    const editorMessage = document.getElementById('editorMessage');
    const listMessage = document.getElementById('featuredPostsMessage');
    const postsList = document.getElementById('featuredPostsList');
    const saveButton = document.getElementById('savePostBtn');
    const saveButtonText = document.getElementById('savePostBtnText');
    const resetButton = document.getElementById('resetFormBtn');
    const titleInput = document.getElementById('postTitle');
    const categoryInput = document.getElementById('postCategory');
    const mediaTypeInput = document.getElementById('mediaType');
    const statusInput = document.getElementById('postStatus');
    const mediaFileInput = document.getElementById('mediaFile');
    const contentInput = document.getElementById('postContent');
    const postIdInput = document.getElementById('featuredPostId');
    const branchName = user.branch_name || '—';

    const setText = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    };

    const showMessage = (message, type = 'info', target = 'editor') => {
        const element = target === 'list' ? listMessage : editorMessage;
        if (!element) return;
        const styles = type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-slate-200 bg-slate-50 text-slate-800';
        element.className = `mt-5 rounded-2xl border px-4 py-3 text-sm ${styles}`;
        element.textContent = message;
        element.classList.remove('hidden');
    };

    const clearMessage = (target = 'editor') => {
        const element = target === 'list' ? listMessage : editorMessage;
        if (!element) return;
        element.textContent = '';
        element.classList.add('hidden');
    };

    const resetForm = () => {
        postIdInput.value = '';
        editorForm.reset();
        statusInput.value = 'Draft';
        mediaTypeInput.value = 'Image';
        saveButtonText.textContent = 'Publish Post';
        clearMessage('editor');
    };

    const buildMediaMarkup = (post) => {
        const mediaUrl = post.media_path ? buildPublicFileUrl(post.media_path) : '';
        if (!mediaUrl) {
            return '<div class="flex h-52 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><i class="fas fa-photo-film text-2xl"></i></div>';
        }
        if (String(post.media_type || '').toLowerCase() === 'video') {
            return `
                <video class="h-52 w-full rounded-2xl bg-black object-cover" controls preload="metadata">
                    <source src="${mediaUrl}" type="video/mp4">
                </video>
            `;
        }
        return `<img src="${mediaUrl}" alt="${post.title || 'Featured media'}" class="h-52 w-full rounded-2xl object-cover bg-slate-100">`;
    };

    const renderPosts = (posts) => {
        const rows = Array.isArray(posts) ? posts : [];
        const draftCount = rows.filter((post) => String(post.status || '').toLowerCase() === 'draft').length;
        const publishedCount = rows.filter((post) => String(post.status || '').toLowerCase() === 'published').length;
        setText('draftCount', String(draftCount));
        setText('publishedCount', String(publishedCount));

        if (!postsList) return;
        if (!rows.length) {
            postsList.innerHTML = `
                <div class="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-8 text-center text-slate-500">
                    No featured posts yet. Publish one on the left to show it on the public page.
                </div>
            `;
            return;
        }

        postsList.innerHTML = rows.map((post) => {
            const statusLabel = String(post.status || 'Draft');
            const statusClass = statusLabel === 'Published'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : statusLabel === 'Draft'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200';
            const branchText = post.branch_name || branchName;
            const updatedAt = post.updated_at ? new Date(post.updated_at).toLocaleString() : '—';

            return `
                <article class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                    ${buildMediaMarkup(post)}
                    <div class="mt-4 flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <span class="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${statusClass}">${statusLabel}</span>
                                <span class="text-[11px] uppercase tracking-[0.2em] text-slate-400 font-bold">${post.category || 'Update'}</span>
                            </div>
                            <h3 class="mt-3 text-lg font-black text-slate-900">${post.title || 'Untitled post'}</h3>
                            <p class="mt-2 text-sm text-slate-600 line-clamp-3">${post.content || ''}</p>
                            <div class="mt-3 text-xs text-slate-500 space-y-1">
                                <div><span class="font-semibold text-slate-700">Branch:</span> ${branchText}</div>
                                <div><span class="font-semibold text-slate-700">Updated:</span> ${updatedAt}</div>
                            </div>
                        </div>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button type="button" class="edit-post-btn inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition" data-post='${encodeURIComponent(JSON.stringify(post))}'>
                            <i class="fas fa-pen mr-2"></i>Edit
                        </button>
                        <button type="button" class="toggle-status-btn inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition" data-id="${post.featured_post_id}" data-status="${statusLabel === 'Published' ? 'Draft' : 'Published'}">
                            <i class="fas fa-${statusLabel === 'Published' ? 'pause' : 'play'} mr-2"></i>${statusLabel === 'Published' ? 'Move to Draft' : 'Publish'}
                        </button>
                        <button type="button" class="delete-post-btn inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition" data-id="${post.featured_post_id}">
                            <i class="fas fa-trash mr-2"></i>Delete
                        </button>
                    </div>
                </article>
            `;
        }).join('');

        postsList.querySelectorAll('.edit-post-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const post = JSON.parse(decodeURIComponent(button.dataset.post || '{}'));
                postIdInput.value = post.featured_post_id || '';
                titleInput.value = post.title || '';
                categoryInput.value = post.category || '';
                mediaTypeInput.value = String(post.media_type || 'Image');
                statusInput.value = String(post.status || 'Draft');
                contentInput.value = post.content || '';
                mediaFileInput.value = '';
                saveButtonText.textContent = 'Update Post';
                clearMessage('editor');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

        postsList.querySelectorAll('.toggle-status-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const postId = Number(button.dataset.id || 0);
                const nextStatus = String(button.dataset.status || 'Draft');
                await updateStatus(postId, nextStatus);
            });
        });

        postsList.querySelectorAll('.delete-post-btn').forEach((button) => {
            button.addEventListener('click', async () => {
                const postId = Number(button.dataset.id || 0);
                await deletePost(postId);
            });
        });
    };

    const loadPosts = async () => {
        clearMessage('list');
        try {
            const response = await axios.get(`${baseApiUrl}/featured_posts.php?action=list-editor&user_id=${encodeURIComponent(user.user_id)}&scope=${encodeURIComponent(listScope)}`);
            const data = response.data || {};
            if (response.status === 200 && data.success) {
                renderPosts(Array.isArray(data.posts) ? data.posts : []);
                setText('managerBranchName', data.role_name ? `${branchName}` : branchName);
                setText('profileMenuBranch', branchName);
            } else {
                throw new Error(data.error || 'Failed to load featured posts.');
            }
        } catch (error) {
            showMessage(error?.response?.data?.error || error.message || 'Failed to load featured posts.', 'error', 'list');
        }
    };

    const updateStatus = async (postId, status) => {
        if (!postId) return;
        const confirm = typeof Swal !== 'undefined'
            ? await Swal.fire({
                icon: 'question',
                title: status === 'Published' ? 'Publish post?' : 'Move post to draft?',
                text: status === 'Published'
                    ? 'This post will appear on the public Featured page.'
                    : 'This post will be hidden from the public Featured page.',
                showCancelButton: true,
                confirmButtonColor: '#b8860b',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Continue'
            })
            : { isConfirmed: true };

        if (!confirm.isConfirmed) return;

        try {
            const response = await axios.post(`${baseApiUrl}/featured_posts.php?action=toggle-status`, {
                user_id: Number(user.user_id),
                featured_post_id: postId,
                status
            });
            const data = response.data || {};
            if (response.status === 200 && data.success) {
                await loadPosts();
                showMessage(data.message || 'Post status updated.', 'success', 'editor');
                resetForm();
            } else {
                throw new Error(data.error || 'Unable to update post status.');
            }
        } catch (error) {
            showMessage(error?.response?.data?.error || error.message || 'Unable to update post status.', 'error', 'editor');
        }
    };

    const deletePost = async (postId) => {
        if (!postId) return;
        const confirm = typeof Swal !== 'undefined'
            ? await Swal.fire({
                icon: 'warning',
                title: 'Delete this post?',
                text: 'This action will permanently remove the post and its uploaded media.',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Delete'
            })
            : { isConfirmed: true };

        if (!confirm.isConfirmed) return;

        try {
            const response = await axios.post(`${baseApiUrl}/featured_posts.php?action=delete`, {
                user_id: Number(user.user_id),
                featured_post_id: postId
            });
            const data = response.data || {};
            if (response.status === 200 && data.success) {
                await loadPosts();
                showMessage(data.message || 'Post deleted.', 'success', 'editor');
                resetForm();
            } else {
                throw new Error(data.error || 'Unable to delete post.');
            }
        } catch (error) {
            showMessage(error?.response?.data?.error || error.message || 'Unable to delete post.', 'error', 'editor');
        }
    };

    editorForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (saveButton) saveButton.disabled = true;
        if (saveButtonText) saveButtonText.textContent = postIdInput.value ? 'Updating...' : 'Publishing...';
        clearMessage('editor');

        try {
            const formData = new FormData();
            formData.append('user_id', String(user.user_id));
            if (postIdInput.value) formData.append('featured_post_id', postIdInput.value);
            formData.append('title', titleInput.value.trim());
            formData.append('category', categoryInput.value.trim());
            formData.append('media_type', mediaTypeInput.value);
            formData.append('status', statusInput.value);
            formData.append('content', contentInput.value.trim());
            if (mediaFileInput.files && mediaFileInput.files[0]) {
                formData.append('media_file', mediaFileInput.files[0]);
            }

            const response = await axios.post(`${baseApiUrl}/featured_posts.php?action=save`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const data = response.data || {};
            if (response.status === 200 && data.success) {
                showMessage(data.message || 'Post saved successfully.', 'success', 'editor');
                resetForm();
                await loadPosts();
            } else {
                throw new Error(data.error || 'Unable to save post.');
            }
        } catch (error) {
            showMessage(error?.response?.data?.error || error.message || 'Unable to save post.', 'error', 'editor');
        } finally {
            if (saveButton) saveButton.disabled = false;
            if (saveButtonText) saveButtonText.textContent = postIdInput.value ? 'Update Post' : 'Publish Post';
        }
    });

    resetButton?.addEventListener('click', resetForm);

    setText('managerNameNav', user.username || user.email || roleLabel);
    setText('profileMenuName', user.username || user.email || roleLabel);
    setText('managerBranchName', branchName);
    setText('profileMenuBranch', branchName);
    if (window.syncManagerShell) {
        window.syncManagerShell(user.username || user.email || roleLabel, branchName, user.email);
    }

    const titleNode = document.querySelector('title');
    if (titleNode) {
        titleNode.textContent = `${pageTitleLabel} | Father & Sons`;
    }

    const heroBadge = document.querySelector('[data-featured-page-badge]');
    if (heroBadge) {
        heroBadge.textContent = studioLabel;
    }

    const heroTitle = document.querySelector('[data-featured-page-title]');
    if (heroTitle) {
        heroTitle.textContent = pageRole === 'desk' ? 'Create Desk Featured Posts' : 'Create Featured Posts';
    }

    const heroDescription = document.querySelector('[data-featured-page-description]');
    if (heroDescription) {
        heroDescription.textContent = pageRole === 'desk'
            ? 'Desk staff can publish photo or video updates that appear on the public Featured page.'
            : 'Staff and branch managers can publish photo or video updates that appear on the public Featured page.';
    }

    const editorHeading = document.querySelector('[data-featured-editor-heading]');
    if (editorHeading) {
        editorHeading.textContent = pageRole === 'desk' ? 'Add a Desk Update' : 'Add a Photo or Video';
    }

    const feedHeading = document.querySelector('[data-featured-feed-heading]');
    if (feedHeading) {
        feedHeading.textContent = pageRole === 'desk' ? 'Desk Feed' : 'Branch Feed';
    }

    loadPosts();
}

document.addEventListener('DOMContentLoaded', initManagerFeaturedPosts);
