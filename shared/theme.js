// ============================================
// 🌙 Shared Theme Utility - Sistem Absensi Kelas
// ============================================
// Provides theme initialization and toggle for Alpine.js components.
// Usage in Alpine.js data():
//   isDark: false,
//   initTheme() { ThemeUtil.init(this); },
//   toggleTheme() { ThemeUtil.toggle(this); }

const ThemeUtil = {
    /**
     * Initialize theme from localStorage or system preference
     * @param {Object} component - Alpine.js component instance (must have `isDark` property)
     */
    init(component) {
        if (localStorage.theme === 'dark' || 
            (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            component.isDark = true;
            document.documentElement.classList.add('dark');
        } else {
            component.isDark = false;
            document.documentElement.classList.remove('dark');
        }
    },

    /**
     * Toggle between light and dark mode
     * @param {Object} component - Alpine.js component instance (must have `isDark` property)
     */
    toggle(component) {
        component.isDark = !component.isDark;
        if (component.isDark) {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        }
    }
};
