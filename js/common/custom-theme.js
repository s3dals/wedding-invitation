import { cache } from '../connection/cache.js';

export const customTheme = (() => {

    const fonts = {
        elegant: { family: 'Playfair Display', css: 'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap', stack: "'Playfair Display', serif" },
        modern: { family: 'Poppins', css: 'https://fonts.googleapis.com/css2?family=Poppins&display=swap', stack: "'Poppins', sans-serif" },
        classic: { family: 'Merriweather', css: 'https://fonts.googleapis.com/css2?family=Merriweather&display=swap', stack: "'Merriweather', serif" },
        script: { family: 'Great Vibes', css: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap', stack: "'Great Vibes', cursive" },
    };

    let active = false;

    /**
     * @param {string} value
     * @returns {boolean}
     */
    const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

    /**
     * @param {string} name
     * @param {string} color
     * @returns {void}
     */
    const setColor = (name, color) => {
        if (isHexColor(color)) {
            document.documentElement.style.setProperty(name, color);
        }
    };

    /**
     * Relative luminance (0-1) used to pick a light/dark Bootstrap baseline
     * for whatever this custom theme doesn't explicitly override.
     *
     * @param {string} hex
     * @returns {number}
     */
    const luminance = (hex) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    /**
     * @param {string|null} key
     * @returns {Promise<void>}
     */
    const setFont = (key) => {
        const font = fonts[key];
        if (!font) {
            return Promise.resolve();
        }

        const c = cache('libs').withForceCache();

        return c.get(font.css).then((uri) => new Promise((res, rej) => {
            const link = document.createElement('link');
            link.onload = res;
            link.onerror = rej;

            link.rel = 'stylesheet';
            link.href = uri;
            document.head.appendChild(link);
        })).then(() => document.fonts.load(`1em "${font.family}"`)).then(() => {
            document.documentElement.style.setProperty('--theme-font', font.stack);
        });
    };

    /**
     * @returns {boolean}
     */
    const isActive = () => active;

    /**
     * @param {ReturnType<typeof import('./storage.js').storage>} config
     * @returns {Promise<void>}
     */
    const apply = (config) => {
        if (!config.get('is_custom_theme')) {
            return Promise.resolve();
        }

        active = true;

        setColor('--theme-primary', config.get('theme_primary_color'));
        setColor('--theme-secondary', config.get('theme_secondary_color'));
        setColor('--theme-background', config.get('theme_background_color'));
        setColor('--theme-text', config.get('theme_text_color'));

        const background = config.get('theme_background_color');
        document.documentElement.setAttribute('data-bs-theme', isHexColor(background) && luminance(background) < 0.5 ? 'dark' : 'light');
        document.documentElement.classList.add('custom-theme-active');
        document.getElementById('button-theme')?.classList.add('d-none');

        return setFont(config.get('theme_font')).catch(() => { });
    };

    return {
        apply,
        isActive,
    };
})();
