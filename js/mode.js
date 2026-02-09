// Dark/Light Mode Toggle
window.ThemeMode = {
    // Initialize theme mode
    init() {
        // Check if we're on index.html (should stay dark by default)
        const isIndexPage = window.location.pathname.includes('index.html') ||
                           (window.location.pathname.endsWith('/') && !window.location.pathname.includes('admin'));

        // Check for saved theme preference
        let savedTheme = localStorage.getItem('theme');

        // If no saved theme, set default based on page
        if (!savedTheme) {
            savedTheme = isIndexPage ? 'dark' : 'light';
            localStorage.setItem('theme', savedTheme);
        }

        this.setTheme(savedTheme);
        this.createToggleButton();
    },

    // Set theme
    setTheme(theme) {
        const html = document.documentElement;

        if (theme === 'light') {
            html.classList.remove('dark');
            html.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            html.classList.add('dark');
            html.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }

        // Update toggle button icon
        this.updateToggleIcon(theme);
    },

    // Toggle between dark and light mode
    toggle() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    },

    // Create toggle button (if not already in HTML)
    createToggleButton() {
        // Check if button already exists
        const existingButton = document.getElementById('themeToggle');
        if (existingButton) {
            // Button exists in HTML, just update the icon
            const currentTheme = localStorage.getItem('theme') || 'light';
            this.updateToggleIcon(currentTheme);
            return;
        }

        // Create button dynamically if not in HTML
        const button = document.createElement('button');
        button.id = 'themeToggle';
        button.className = 'fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gold-500 hover:bg-gold-400 text-black shadow-lg transition-all duration-300 flex items-center justify-center group';
        button.setAttribute('aria-label', 'Toggle theme');
        button.onclick = () => this.toggle();

        // Create icon container
        const iconContainer = document.createElement('div');
        iconContainer.className = 'relative w-6 h-6';

        // Sun icon (for dark mode - click to switch to light)
        const sunIcon = document.createElement('i');
        sunIcon.className = 'fas fa-sun absolute inset-0 transition-opacity duration-300';
        sunIcon.id = 'sunIcon';

        // Moon icon (for light mode - click to switch to dark)
        const moonIcon = document.createElement('i');
        moonIcon.className = 'fas fa-moon absolute inset-0 transition-opacity duration-300';
        moonIcon.id = 'moonIcon';

        iconContainer.appendChild(sunIcon);
        iconContainer.appendChild(moonIcon);
        button.appendChild(iconContainer);

        document.body.appendChild(button);
        const currentTheme = localStorage.getItem('theme') || 'light';
        this.updateToggleIcon(currentTheme);
    },

    // Update toggle icon based on current theme
    updateToggleIcon(theme) {
        const sunIcon = document.getElementById('sunIcon');
        const moonIcon = document.getElementById('moonIcon');

        if (sunIcon && moonIcon) {
            if (theme === 'light') {
                // Show moon icon (to switch back to dark)
                sunIcon.style.opacity = '0';
                moonIcon.style.opacity = '1';
            } else {
                // Show sun icon (to switch to light)
                sunIcon.style.opacity = '1';
                moonIcon.style.opacity = '0';
            }
        }
    },

    // Get current theme
    getCurrentTheme() {
        // Check if we're on index.html (should stay dark by default)
        const isIndexPage = window.location.pathname.includes('index.html') ||
                           (window.location.pathname.endsWith('/') && !window.location.pathname.includes('admin'));

        const savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
            return isIndexPage ? 'dark' : 'light';
        }
        return savedTheme;
    }
};

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeMode.init();
        // Add event listener to button if it exists
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => ThemeMode.toggle());
        }
    });
} else {
    ThemeMode.init();
    // Add event listener to button if it exists
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => ThemeMode.toggle());
    }
}
