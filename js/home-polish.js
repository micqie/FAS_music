document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('body > nav');
    const carousel = document.getElementById('instrumentCarousel');
    const previousButton = document.getElementById('instrumentPrev');
    const nextButton = document.getElementById('instrumentNext');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const progress = document.createElement('div');
    progress.className = 'home-scroll-progress';
    progress.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progress);

    const navLinks = nav ? Array.from(nav.querySelectorAll('a[href^="#"]')) : [];
    const trackedSections = ['home', 'about', 'courses']
        .map(id => document.getElementById(id))
        .filter(Boolean);
    let previousScrollY = window.scrollY;
    let scrollDirection = 'down';
    let scrollTicking = false;

    const syncScrollExperience = () => {
        const scrollY = window.scrollY;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        scrollDirection = scrollY >= previousScrollY ? 'down' : 'up';
        if (nav) nav.classList.toggle('home-nav-compact', window.scrollY > 24);
        progress.style.transform = `scaleX(${Math.min(1, Math.max(0, scrollY / maxScroll))})`;

        if (!reducedMotion) {
            const musicShift = Math.max(-36, Math.min(36, (scrollY % 900) * 0.04 - 18));
            document.body.style.setProperty('--music-parallax', `${musicShift}px`);
            document.body.style.setProperty('--music-parallax-reverse', `${musicShift * -0.35}px`);
            document.body.style.setProperty('--hero-scroll-shift', `${Math.min(48, scrollY * 0.08)}px`);
        }

        let activeId = trackedSections[0]?.id || '';
        trackedSections.forEach(section => {
            if (section.getBoundingClientRect().top <= window.innerHeight * 0.42) activeId = section.id;
        });
        navLinks.forEach(link => {
            link.classList.toggle('home-nav-active', link.getAttribute('href') === `#${activeId}`);
        });

        previousScrollY = scrollY;
        scrollTicking = false;
    };

    const requestScrollSync = () => {
        if (scrollTicking) return;
        scrollTicking = true;
        window.requestAnimationFrame(syncScrollExperience);
    };
    syncScrollExperience();
    window.addEventListener('scroll', requestScrollSync, { passive: true });
    window.addEventListener('resize', requestScrollSync);

    if (carousel && previousButton && nextButton) {
        carousel.querySelectorAll(':scope > div').forEach(card => {
            const name = card.querySelector('span')?.textContent?.trim() || 'Instrument';
            const image = card.querySelector('img');
            if (image && !image.alt) image.alt = `${name} lessons`;
            card.setAttribute('aria-label', `${name} lessons`);
        });

        const syncControls = () => {
            const end = Math.max(0, carousel.scrollWidth - carousel.clientWidth);
            previousButton.disabled = carousel.scrollLeft <= 2;
            nextButton.disabled = carousel.scrollLeft >= end - 2;
        };

        const moveCarousel = direction => {
            carousel.scrollBy({
                left: direction * Math.max(carousel.clientWidth * 0.78, 220),
                behavior: reducedMotion ? 'auto' : 'smooth'
            });
        };

        previousButton.addEventListener('click', () => moveCarousel(-1));
        nextButton.addEventListener('click', () => moveCarousel(1));
        carousel.addEventListener('scroll', syncControls, { passive: true });
        carousel.addEventListener('keydown', event => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                moveCarousel(-1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                moveCarousel(1);
            }
        });
        window.addEventListener('resize', syncControls);
        syncControls();
    }

    const revealTargets = document.querySelectorAll(
        '.home-featured > div, #about, #courses > div > div:first-child, .instrument-carousel-shell, .home-music-footer > div:not(.home-music-ambience)'
    );
    revealTargets.forEach(element => element.classList.add('home-polish-reveal'));

    if (reducedMotion || !('IntersectionObserver' in window)) {
        revealTargets.forEach(element => element.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.toggle('reveal-from-up', scrollDirection === 'up');
                entry.target.classList.add('is-visible');
            } else {
                entry.target.classList.remove('is-visible');
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    revealTargets.forEach(element => observer.observe(element));
});
