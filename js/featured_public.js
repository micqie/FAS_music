function initFeaturedPublicFeed() {
    const grid = document.getElementById('featuredPublicGrid');
    const statusBox = document.getElementById('featuredPublicStatus');
    if (!grid) return;

    const showStatus = (message, type = 'info') => {
        if (!statusBox) return;
        const styles = type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-slate-200 bg-white text-slate-700';
        statusBox.className = `mb-6 rounded-2xl border px-4 py-3 text-sm ${styles}`;
        statusBox.textContent = message;
        statusBox.classList.remove('hidden');
    };

    const formatDate = (value) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const mediaMarkup = (post) => {
        const mediaUrl = post.media_path ? buildPublicFileUrl(post.media_path) : '';
        if (!mediaUrl) {
            return '<div class="flex h-56 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400"><i class="fas fa-photo-film text-3xl"></i></div>';
        }

        if (String(post.media_type || '').toLowerCase() === 'video') {
            return `
                <video class="h-56 w-full rounded-3xl bg-black object-cover" controls preload="metadata">
                    <source src="${mediaUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            `;
        }

        return `<img src="${mediaUrl}" alt="${post.title || 'Featured post'}" class="h-56 w-full rounded-3xl object-cover bg-zinc-100">`;
    };

    const renderPosts = (posts) => {
        const rows = Array.isArray(posts) ? posts : [];
        if (!rows.length) {
            grid.innerHTML = `
                <div class="xl:col-span-3 rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    No featured posts are published yet. Please check back soon.
                </div>
            `;
            showStatus('No published posts found yet.', 'info');
            return;
        }

        showStatus(`${rows.length} published post${rows.length === 1 ? '' : 's'} available.`, 'success');

        grid.innerHTML = rows.map((post, index) => {
            const isLead = index === 0;
            const branchLabel = post.branch_name || 'Father & Sons Music Academy';
            return `
                <article class="${isLead ? 'xl:col-span-2' : ''} rounded-3xl border border-zinc-200 bg-white p-5 shadow-lg shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900">
                    ${mediaMarkup(post)}
                    <div class="mt-5 flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-gold-600 dark:text-gold-400">${post.category || 'Update'}</span>
                        <span class="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-bold">${branchLabel}</span>
                    </div>
                    <h3 class="mt-4 text-2xl ${isLead ? 'sm:text-3xl' : 'sm:text-2xl'} font-serif text-zinc-900 dark:text-white">${post.title || 'Featured post'}</h3>
                    <p class="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">${post.content || ''}</p>
                    <div class="mt-5 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                        ${post.published_at ? `<span><i class="fas fa-calendar-day mr-1 text-gold-500"></i>${formatDate(post.published_at)}</span>` : ''}
                        ${post.created_by_name ? `<span><i class="fas fa-user mr-1 text-gold-500"></i>${post.created_by_name.trim()}</span>` : ''}
                    </div>
                </article>
            `;
        }).join('');
    };

    const loadPosts = async () => {
        try {
            const response = await axios.get(`${baseApiUrl}/featured_posts.php?action=list-public&limit=12`);
            const data = response.data || {};
            if (response.status === 200 && data.success) {
                renderPosts(Array.isArray(data.posts) ? data.posts : []);
            } else {
                throw new Error(data.error || 'Failed to load featured posts.');
            }
        } catch (error) {
            if (statusBox) {
                showStatus(error?.response?.data?.error || error.message || 'Failed to load featured posts.', 'error');
            }
            grid.innerHTML = `
                <div class="xl:col-span-3 rounded-3xl border border-dashed border-red-200 bg-red-50 p-8 text-center text-red-700">
                    Unable to load featured posts right now.
                </div>
            `;
        }
    };

    loadPosts();
}

document.addEventListener('DOMContentLoaded', initFeaturedPublicFeed);
