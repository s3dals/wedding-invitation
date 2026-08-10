import { cache } from '../connection/cache.js';

export const customTheme = (() => {

    /**
     * Latin faces. None of these carry Arabic glyphs, which is why the Arabic
     * script gets its own list below rather than sharing this one.
     */
    const fonts = {
        elegant: { family: 'Playfair Display', css: 'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap', stack: "'Playfair Display', serif" },
        modern: { family: 'Poppins', css: 'https://fonts.googleapis.com/css2?family=Poppins&display=swap', stack: "'Poppins', sans-serif" },
        classic: { family: 'Merriweather', css: 'https://fonts.googleapis.com/css2?family=Merriweather&display=swap', stack: "'Merriweather', serif" },
        script: { family: 'Great Vibes', css: 'https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap', stack: "'Great Vibes', cursive" },
    };

    /**
     * Arabic faces, requested with subset=arabic so only the Arabic block is
     * downloaded. Reem Kufi is a display face - fine for names and headings,
     * hard work as body text - which is why the label says so in the dashboard.
     */
    const arabicFonts = {
        naskh: { family: 'Noto Naskh Arabic', css: 'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic&display=swap&subset=arabic', stack: "'Noto Naskh Arabic', serif" },
        amiri: { family: 'Amiri', css: 'https://fonts.googleapis.com/css2?family=Amiri&display=swap&subset=arabic', stack: "'Amiri', serif" },
        cairo: { family: 'Cairo', css: 'https://fonts.googleapis.com/css2?family=Cairo&display=swap&subset=arabic', stack: "'Cairo', sans-serif" },
        tajawal: { family: 'Tajawal', css: 'https://fonts.googleapis.com/css2?family=Tajawal&display=swap&subset=arabic', stack: "'Tajawal', sans-serif" },
        kufi: { family: 'Reem Kufi', css: 'https://fonts.googleapis.com/css2?family=Reem+Kufi&display=swap&subset=arabic', stack: "'Reem Kufi', sans-serif" },
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
     * WCAG relative luminance - the gamma-corrected kind, unlike luminance()
     * above. The distinction matters here: a light/dark baseline is a coarse
     * choice that survives an approximation, but picking a readable label
     * colour does not.
     *
     * @param {string} hex
     * @returns {number}
     */
    const relativeLuminance = (hex) => {
        const [r, g, b] = [1, 3, 5]
            .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    /**
     * WCAG contrast ratio, 1 (identical) to 21 (black on white).
     *
     * @param {string} a
     * @param {string} b
     * @returns {number}
     */
    const contrast = (a, b) => {
        const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);

        return (hi + 0.05) / (lo + 0.05);
    };

    /**
     * The label colour for text sitting on `background`.
     *
     * Chosen by comparing both candidates rather than thresholding luminance:
     * on mid-tones - dusty rose, sand, gold, the colours weddings actually use
     * - a threshold picks white where near-black is clearly more readable.
     *
     * @param {string} background
     * @returns {string}
     */
    const readableOn = (background) => {
        if (!isHexColor(background)) {
            return '#ffffff';
        }

        return contrast('#ffffff', background) >= contrast('#111111', background) ? '#ffffff' : '#111111';
    };

    /**
     * @param {Record<string, {family: string, css: string, stack: string}>} table
     * @param {string|null} key
     * @returns {Promise<string|null>}
     */
    const loadFont = (table, key) => {
        const font = table[key];
        if (!font) {
            return Promise.resolve(null);
        }

        const c = cache('libs').withForceCache();

        return c.get(font.css).then((uri) => new Promise((res, rej) => {
            const link = document.createElement('link');
            link.onload = res;
            link.onerror = rej;

            link.rel = 'stylesheet';
            link.href = uri;
            document.head.appendChild(link);
        })).then(() => document.fonts.load(`1em "${font.family}"`)).then(() => font.stack);
    };

    /**
     * The two faces are combined into one stack rather than applied separately.
     * A browser resolves font-family per character, so Latin glyphs come from
     * the Latin face and Arabic glyphs fall through to the Arabic one - which
     * is what an invitation mixing "Saed & Aya" with Arabic actually needs.
     *
     * @param {string|null} latinKey
     * @param {string|null} arabicKey
     * @returns {Promise<void>}
     */
    const setFonts = (latinKey, arabicKey) => Promise.all([
        loadFont(fonts, latinKey),
        loadFont(arabicFonts, arabicKey),
    ]).then(([latin, arabic]) => {
        const root = document.documentElement.style;

        if (arabic) {
            root.setProperty('--theme-font-arabic', arabic);
        }

        if (latin || arabic) {
            root.setProperty('--theme-font', [latin, arabic].filter(Boolean).join(', '));
        }
    });

    /**
     * @returns {boolean}
     */
    const isActive = () => active;

    /**
     * Arabic, Arabic Supplement, Arabic Extended-A and the two presentation-form
     * blocks. Written as escapes: several characters in these ranges are
     * invisible or bidi-control marks, which do not survive being pasted.
     */
    const ARABIC = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

    /**
     * Direction is applied separately from the colours, and later: "auto" reads
     * the invitation's own words, which are only in the DOM once the stored
     * content has been applied. Runs while the loading screen is still up, so
     * nothing is seen reflowing.
     *
     * @param {ReturnType<typeof import('./storage.js').storage>} config
     * @returns {void}
     */
    const applyDirection = (config) => {
        const setting = config.get('theme_direction') ?? 'auto';

        const rtl = setting === 'auto'
            ? ARABIC.test(document.body.textContent ?? '')
            : setting === 'rtl';

        if (!rtl) {
            return;
        }

        document.documentElement.setAttribute('dir', 'rtl');

        // Only correct the language when it is still the template's default -
        // an owner who set something specific should keep it.
        if (document.documentElement.getAttribute('lang') === 'en') {
            document.documentElement.setAttribute('lang', 'ar');
        }
    };

    /**
     * @param {ReturnType<typeof import('./storage.js').storage>} config
     * @returns {Promise<void>}
     */
    const apply = (config) => {
        if (!config.get('is_custom_theme')) {
            return Promise.resolve();
        }

        active = true;

        const primary = config.get('theme_primary_color');
        const secondary = config.get('theme_secondary_color');
        const background = config.get('theme_background_color');
        const text = config.get('theme_text_color');

        setColor('--theme-primary', primary);
        setColor('--theme-secondary', secondary);
        setColor('--theme-background', background);
        setColor('--theme-text', text);

        // Button labels used to be left at Bootstrap's white whatever the
        // button was painted, which is unreadable on the pale golds and blushes
        // this is mostly used for.
        setColor('--theme-on-primary', readableOn(primary));
        setColor('--theme-on-secondary', readableOn(secondary));

        // The wave dividers have always taken the text colour; that stays the
        // default, and this only overrides it when a colour was chosen.
        setColor('--theme-divider', config.get('theme_divider_color') || text);

        document.documentElement.setAttribute('data-bs-theme', isHexColor(background) && luminance(background) < 0.5 ? 'dark' : 'light');
        document.documentElement.classList.add('custom-theme-active');
        document.getElementById('button-theme')?.classList.add('d-none');

        return setFonts(config.get('theme_font'), config.get('theme_font_arabic')).catch(() => { });
    };

    return {
        apply,
        applyDirection,
        isActive,
        contrast,
        readableOn,
    };
})();
