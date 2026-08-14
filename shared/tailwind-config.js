// ============================================
// 🎨 Shared Tailwind Config - Sistem Absensi Kelas
// ============================================
// Load AFTER cdn.tailwindcss.com script tag
// <script src="https://cdn.tailwindcss.com"></script>
// <script src="../shared/tailwind-config.js"></script>

tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { 
                sans: ['Inter', 'sans-serif'],
                serif: ['Outfit', 'sans-serif'],
                label: ['Inter', 'sans-serif'],
            },
            colors: {
                primary: '#094cb2',
                'primary-container': '#d3e4ff',
                tertiary: '#6d5e00',
                surface: {
                    lowest: '#ffffff',
                    dim: '#f3f4f6', 
                    'dark-lowest': '#09090b', 
                    'dark-dim': '#18181b',
                }
            }
        }
    }
};
