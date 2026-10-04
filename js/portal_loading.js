(function () {
    const role = (location.pathname.match(/\/pages\/(admin|manager|desk|guardian|student)\//i) || [])[1]?.toLowerCase();
    if (!role || !document.body) return;

    const skeleton = document.createElement('div');
    skeleton.className = 'fas-page-skeleton';
    skeleton.dataset.role = role;
    skeleton.setAttribute('role', 'status');
    skeleton.setAttribute('aria-live', 'polite');
    skeleton.innerHTML = `
        <div class="fas-skeleton-topbar" aria-hidden="true">
            <span class="fas-skeleton-block fas-skeleton-logo"></span>
            <span class="fas-skeleton-block fas-skeleton-avatar"></span>
        </div>
        <div class="fas-skeleton-layout">
            <aside class="fas-skeleton-sidebar" aria-hidden="true">
                <span class="fas-skeleton-block fas-skeleton-card"></span>
                <div class="fas-skeleton-gap"></div>
                <span class="fas-skeleton-block fas-skeleton-menu"></span>
                <span class="fas-skeleton-block fas-skeleton-menu"></span>
                <span class="fas-skeleton-block fas-skeleton-menu"></span>
                <span class="fas-skeleton-block fas-skeleton-menu"></span>
            </aside>
            <div class="fas-skeleton-content">
                <span class="fas-skeleton-block fas-skeleton-title" aria-hidden="true"></span>
                <span class="fas-skeleton-block fas-skeleton-subtitle" aria-hidden="true"></span>
                <div class="fas-skeleton-cards" aria-hidden="true">
                    <span class="fas-skeleton-block fas-skeleton-card"></span>
                    <span class="fas-skeleton-block fas-skeleton-card"></span>
                    <span class="fas-skeleton-block fas-skeleton-card"></span>
                </div>
                <span class="fas-skeleton-block fas-skeleton-panel" aria-hidden="true"></span>
                <p class="fas-skeleton-status">Loading your page…</p>
                <button class="fas-skeleton-retry" type="button">Reload page</button>
            </div>
        </div>`;
    document.body.prepend(skeleton);
    document.body.setAttribute('aria-busy', 'true');
    skeleton.querySelector('.fas-skeleton-retry').addEventListener('click', () => location.reload());

    let pending = 0;
    let explicitPending = role === 'student' || role === 'guardian' ? 1 : 0;
    let domReady = false;
    let finished = false;
    let readyTimer;
    const startedAt = Date.now();

    function considerReady() {
        clearTimeout(readyTimer);
        if (finished || !domReady || pending || explicitPending) return;
        readyTimer = setTimeout(() => {
            if (pending || explicitPending || finished) return;
            finished = true;
            skeleton.remove();
            document.body.removeAttribute('aria-busy');
        }, Math.max(300, 650 - (Date.now() - startedAt)));
    }

    function beginRequest() {
        if (finished) return () => {};
        pending++;
        clearTimeout(readyTimer);
        let ended = false;
        return () => {
            if (ended) return;
            ended = true;
            pending--;
            considerReady();
        };
    }

    const nativeFetch = window.fetch;
    if (typeof nativeFetch === 'function') {
        window.fetch = function (...args) {
            const end = beginRequest();
            try { return Promise.resolve(nativeFetch.apply(this, args)).finally(end); }
            catch (error) { end(); throw error; }
        };
    }

    const nativeSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (...args) {
        const end = beginRequest();
        this.addEventListener('loadend', end, { once: true });
        try { return nativeSend.apply(this, args); }
        catch (error) { end(); throw error; }
    };

    window.fasPageLoading = {
        track(promise) {
            Promise.resolve(promise).catch((error) => {
                console.error('Page initialization failed:', error);
            }).finally(() => {
                explicitPending = 0;
                considerReady();
            });
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        domReady = true;
        considerReady();
    }, { once: true });

    setTimeout(() => {
        if (!finished) {
            skeleton.classList.add('fas-skeleton-slow');
            skeleton.querySelector('.fas-skeleton-status').textContent = 'This is taking longer than expected. You can reload the page.';
        }
    }, 15000);
})();
