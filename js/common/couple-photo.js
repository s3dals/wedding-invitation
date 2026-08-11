export const couplePhoto = (() => {

    /**
     * The photo lives in the database and is served by the API, not by the
     * static host, so the URL has to be built from the same data-url the rest of
     * the app uses.
     *
     * The access key travels in the query string because an <img src> cannot
     * send headers. That key is already printed in this page's HTML, so it is
     * not a new exposure - and the route it reaches returns one image.
     *
     * @param {ReturnType<typeof import('./storage.js').storage>} config
     * @returns {void}
     */
    const apply = (config) => {
        const img = document.getElementById('photo-couple');
        if (!img) {
            return;
        }

        const version = config.get('photo_couple_version');
        if (!version) {
            return;
        }

        const base = document.body.getAttribute('data-url');
        const key = document.body.getAttribute('data-key');
        if (!base || !key) {
            return;
        }

        // The version is a hash of the file. It is what lets the response carry
        // a year-long immutable cache header: a different photo is a different
        // URL, so nothing stale is ever shown.
        const url = new URL('api/v2/photo', base);
        url.searchParams.set('key', key);
        url.searchParams.set('v', version);

        img.src = url.toString();
        img.classList.remove('d-none');
    };

    return {
        apply,
    };
})();
