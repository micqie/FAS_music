function initFeaturedPublicFeed() {
    const grid = document.getElementById('featuredPublicGrid');
    const statusBox = document.getElementById('featuredPublicStatus');
    const categoryFilter = document.getElementById('categoryFilter');
    if (!grid) return;

    let allPosts = [];

    const formatDate = (value) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '';
        return parsed.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    };

    // Category priority order
    const categoryPriority = {
        'announcement': 0,
        'event': 1,
        'promo': 2,
        'recital': 3,
        'update': 4
    };

    const getCategoryPriority = (category) => {
        const normalized = String(category || 'update').toLowerCase();
        return categoryPriority[normalized] !== undefined ? categoryPriority[normalized] : 5;
    };

    const getCategoryStyles = (category) => {
        const normalized = String(category || 'update').toLowerCase();
        const styles = {
            'announcement': { badge: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400', ring: 'ring-2 ring-red-500/30' },
            'event': { badge: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400', ring: 'ring-2 ring-blue-500/30' },
            'promo': { badge: 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400', ring: 'ring-2 ring-green-500/30' },
            'recital': { badge: 'border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400', ring: 'ring-2 ring-purple-500/30' },
            'update': { badge: 'border-gold-500/30 bg-gold-500/10 text-gold-600 dark:text-gold-400', ring: '' }
        };
        return styles[normalized] || styles['update'];
    };

    const renderPosts = () => {
        let filtered = allPosts;
        const selectedCategory = categoryFilter?.value || '';

        if (selectedCategory) {
            filtered = allPosts.filter(p => String(p.category || '').toLowerCase() === selectedCategory.toLowerCase());
        }

        if (!filtered.length) {
            grid.innerHTML = `
                <div class="xl:col-span-3 rounded-3xl border border-dashed border-zinc-300 bg-white p-8 text-center text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    No featured posts are published yet. Please check back soon.
                </div>
            `;
            statusBox.classList.add('hidden');
            return;
        }

        // Sort by category priority
        const sorted = [...filtered].sort((a, b) => {
            const priorityDiff = getCategoryPriority(a.category) - getCategoryPriority(b.category);
            if (priorityDiff !== 0) return priorityDiff;
            // Secondary sort by date (newest first)
            return new Date(b.published_at) - new Date(a.published_at);
        });

        statusBox.classList.add('hidden');

        grid.innerHTML = sorted.map((post) => {
            const branchLabel = post.branch_name || 'Father & Sons Music Academy';
            const categoryStyles = getCategoryStyles(post.category);
            const isHighPriority = getCategoryPriority(post.category) <= 1;
            const mediaUrl = post.media_path ? buildPublicFileUrl(post.media_path) : '';

            let mediaMarkup = '';
            if (isHighPriority) {
                // Smaller media for high priority categories
                if (!mediaUrl) {
                    mediaMarkup = '<div class="flex aspect-square items-center justify-center bg-zinc-100 text-zinc-400"><i class="fas fa-photo-film text-2xl"></i></div>';
                } else if (String(post.media_type || '').toLowerCase() === 'video') {
                    mediaMarkup = `
                        <video class="aspect-square w-full bg-black object-cover cursor-pointer" data-media-url="${mediaUrl}" data-media-type="video" preload="metadata">
                            <source src="${mediaUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    `;
                } else {
                    mediaMarkup = `<img src="${mediaUrl}" alt="${post.title || 'Featured post'}" class="aspect-square w-full object-cover bg-zinc-100 cursor-pointer" data-media-url="${mediaUrl}" data-media-type="image">`;
                }
            } else {
                // Regular size media
                if (!mediaUrl) {
                    mediaMarkup = '<div class="flex aspect-square items-center justify-center bg-zinc-100 text-zinc-400"><i class="fas fa-photo-film text-3xl"></i></div>';
                } else if (String(post.media_type || '').toLowerCase() === 'video') {
                    mediaMarkup = `
                        <video class="aspect-square w-full bg-black object-cover cursor-pointer" data-media-url="${mediaUrl}" data-media-type="video" preload="metadata">
                            <source src="${mediaUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    `;
                } else {
                    mediaMarkup = `<img src="${mediaUrl}" alt="${post.title || 'Featured post'}" class="aspect-square w-full object-cover bg-zinc-100 cursor-pointer" data-media-url="${mediaUrl}" data-media-type="image">`;
                }
            }

            return `
                <article class="${isHighPriority ? `xl:col-span-3 ${categoryStyles.ring}` : ''} rounded-2xl border border-zinc-200 bg-white shadow-lg shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden flex flex-col">
                    <div class="p-3 rounded-t-2xl">
                        ${mediaMarkup}
                    </div>
                    <div class="p-4">
                        <div class="flex flex-wrap items-center gap-2 mb-3">
                            <span class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] ${categoryStyles.badge}">${post.category || 'Update'}</span>
                            <span class="text-[11px] uppercase tracking-[0.22em] text-zinc-400 font-bold">${branchLabel}</span>
                        </div>
                        <h3 class="text-lg font-serif text-zinc-900 dark:text-white mb-2">${post.title || 'Featured post'}</h3>
                        <p class="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-2 mb-3">${post.content || ''}</p>
                        <div class="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                            ${post.published_at ? `<span><i class="fas fa-calendar-day mr-1 text-gold-500"></i>${formatDate(post.published_at)}</span>` : ''}
                            ${post.created_by_name ? `<span><i class="fas fa-user mr-1 text-gold-500"></i>${post.created_by_name.trim()}</span>` : ''}
                        </div>
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
                allPosts = Array.isArray(data.posts) ? data.posts : [];
                renderPosts();
            } else {
                throw new Error(data.error || 'Failed to load featured posts.');
            }
        } catch (error) {
            if (statusBox) {
                statusBox.className = 'mb-6 rounded-2xl border px-4 py-3 text-sm border-red-200 bg-red-50 text-red-800';
                statusBox.textContent = error?.response?.data?.error || error.message || 'Failed to load featured posts.';
                statusBox.classList.remove('hidden');
            }
            grid.innerHTML = `
                <div class="xl:col-span-3 rounded-3xl border border-dashed border-red-200 bg-red-50 p-8 text-center text-red-700">
                    Unable to load featured posts right now.
                </div>
            `;
        }
    };

    if (categoryFilter) {
        categoryFilter.addEventListener('change', renderPosts);
    }

    // Create media modal
    const createMediaModal = () => {
        if (document.getElementById('mediaModal')) return;
        const modal = document.createElement('div');
        modal.id = 'mediaModal';
        modal.className = 'fixed inset-0 z-[999] hidden bg-black/80 backdrop-blur-sm flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="relative w-full max-w-4xl max-h-[90vh] flex items-center justify-center">
                <button onclick="document.getElementById('mediaModal').classList.add('hidden')" class="absolute top-0 right-0 text-white hover:text-gold-400 text-4xl -mt-12">
                    <i class="fas fa-times"></i>
                </button>
                <div id="modalContent" class="w-full h-auto flex items-center justify-center"></div>
            </div>
        `;
        document.body.appendChild(modal);
    };

    const openMediaModal = (mediaUrl, mediaType) => {
        const modal = document.getElementById('mediaModal');
        const content = document.getElementById('modalContent');

        if (mediaType === 'video') {
            content.innerHTML = `<video class="max-w-full max-h-[90vh] rounded-lg" controls autoplay><source src="${mediaUrl}" type="video/mp4">Your browser does not support the video tag.</video>`;
        } else {
            content.innerHTML = `<img src="${mediaUrl}" alt="Featured post" class="max-w-full max-h-[90vh] rounded-lg object-contain">`;
        }

        modal.classList.remove('hidden');
    };

    // Initialize modal and attach click handlers
    setTimeout(() => {
        createMediaModal();
        grid.addEventListener('click', (e) => {
            const media = e.target.closest('[data-media-url]');
            if (media) {
                const mediaUrl = media.getAttribute('data-media-url');
                const mediaType = media.getAttribute('data-media-type');
                openMediaModal(mediaUrl, mediaType);
            }
        });
    }, 100);

    loadPosts();
}

document.addEventListener('DOMContentLoaded', initFeaturedPublicFeed);
