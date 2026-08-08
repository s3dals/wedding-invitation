import { cache } from '../connection/cache.js';

export const customTheme = (() => {

    const fonts = {
        elegant: { family: 'Playfair Display', css: 'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap', stack: "'Playfair Display', serif" },
        modern: { family: 'Poppins', css: 'https://fonts.googleapis.com/css2?family=Poppins&display=swap', stack: "'Poppins', sans-serif" },
        classic: { family: 'Merriweather', css: 'https://fonts.googleapis.com/css2?family=Merriweather&display=swap', stack: "'Merriweather', serif" },
        script: { family: 'Great Vibes', css: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap', stack: "'Great Vibes', cursive" },
    };

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
     * @param {ReturnType<typeof import('./storage.js').storage>} config
     * @returns {Promise<void>}
     */
    const apply = (config) => {
        setColor('--theme-primary', config.get('theme_primary_color'));
        setColor('--theme-secondary', config.get('theme_secondary_color'));
        setColor('--theme-background', config.get('theme_background_color'));

        return setFont(config.get('theme_font')).catch(() => { });
    };

    return {
        apply,
    };
})();
