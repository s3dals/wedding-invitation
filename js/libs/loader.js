/**
 * @param {string} css
 * @returns {Promise<void>}
 */
const linkStylesheet = (css) => new Promise((res, rej) => {
    const link = document.createElement('link');
    link.onload = res;
    link.onerror = rej;

    link.rel = 'stylesheet';
    link.href = css;
    document.head.appendChild(link);
});

/**
 * @param {string} src
 * @returns {Promise<void>}
 */
const loadScript = (src) => new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.onload = res;
    sc.onerror = rej;

    sc.src = src;
    document.head.appendChild(sc);
});

/**
 * @returns {Promise<void>}
 */
const loadAOS = () => {

    const urlCss = './assets/libs/aos/aos.css';
    const urlJs = './assets/libs/aos/aos.js';

    return Promise.all([linkStylesheet(urlCss), loadScript(urlJs)]).then(() => {
        if (typeof window.AOS === 'undefined') {
            throw new Error('AOS library failed to load');
        }

        window.AOS.init();
    });
};

/**
 * @returns {Promise<void>}
 */
const loadConfetti = () => {
    const url = './assets/libs/confetti/confetti.browser.js';

    return loadScript(url).then(() => {
        if (typeof window.confetti === 'undefined') {
            throw new Error('Confetti library failed to load');
        }
    });
};

/**
 * Loads the decorative and Qur'anic fallback fonts. The CSS files are served
 * from the same origin now, so they are linked directly rather than through
 * the blob-URL cache: fonts served from a blob: URL hit a CORS wall in the
 * browser and fail with "A network error occurred".
 *
 * @returns {Promise<void>}
 */
const loadAdditionalFont = () => {

    const fonts = [
        { css: './assets/fonts/sacramento.css', family: 'Sacramento' },
        { css: './assets/fonts/noto-naskh-arabic.css', family: 'Noto Naskh Arabic' },
    ];

    /**
     * @param {{css: string, family: string}} font
     * @returns {Promise<void>}
     */
    const loadFont = ({ css, family }) => linkStylesheet(css)
        .then(() => document.fonts.load(`1em "${family}"`));

    return Promise.all(fonts.map(loadFont));
};

/**
 * @param {Object} [opt]
 * @param {boolean} [opt.aos=true] - Load AOS library
 * @param {boolean} [opt.confetti=true] - Load Confetti library
 * @param {boolean} [opt.additionalFont=true] - Load Additional Font
 * @returns {Promise<void>}
 */
export const loader = (opt = {}) => {
    const promises = [];

    if (opt?.aos ?? true) {
        promises.push(loadAOS().catch((err) => console.warn('AOS failed to load (non-critical):', err)));
    }

    if (opt?.confetti ?? true) {
        promises.push(loadConfetti().catch((err) => console.warn('Confetti failed to load (non-critical):', err)));
    }

    if (opt?.additionalFont ?? true) {
        promises.push(loadAdditionalFont());
    }

    return Promise.all(promises);
};
