import { bs } from '../libs/bootstrap.js';
import { session } from './session.js';
import { request, HTTP_GET } from '../connection/request.js';

export const customPhotos = (() => {

    const slots = {
        home: ['#photo-home-bg', '#photo-home-avatar', '#photo-home-welcome', '.photo-home-desktop-slide'],
        bride: ['#photo-bride'],
        groom: ['#photo-groom'],
    };

    /**
     * @param {string[]} selectors
     * @param {string} url
     * @returns {void}
     */
    const setSlot = (selectors, url) => {
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => el.setAttribute('data-src', url));
        });
    };

    /**
     * @param {{id: number, url: string}[]} items
     * @returns {void}
     */
    const rebuildGallery = (items) => {
        if (!items || items.length === 0) {
            return;
        }

        const carouselId = 'carousel-image-one';
        const carouselEl = document.getElementById(carouselId);
        if (!carouselEl) {
            return;
        }

        bs.carousel(carouselId).dispose();

        const indicators = document.createElement('div');
        indicators.className = 'carousel-indicators';

        const inner = document.createElement('div');
        inner.className = 'carousel-inner rounded-4';

        items.forEach((item, index) => {
            const indicator = document.createElement('button');
            indicator.type = 'button';
            indicator.setAttribute('data-bs-target', `#${carouselId}`);
            indicator.setAttribute('data-bs-slide-to', String(index));
            indicator.setAttribute('aria-label', `Slide ${index + 1}`);
            if (index === 0) {
                indicator.className = 'active';
                indicator.setAttribute('aria-current', 'true');
            }
            indicators.appendChild(indicator);

            const slide = document.createElement('div');
            slide.className = index === 0 ? 'carousel-item active' : 'carousel-item';

            const img = document.createElement('img');
            img.src = item.url;
            img.alt = 'gallery';
            img.className = 'd-block img-fluid cursor-pointer';
            img.setAttribute('onclick', 'undangan.guest.modal(this)');

            slide.appendChild(img);
            inner.appendChild(slide);
        });

        carouselEl.querySelector('.carousel-indicators')?.replaceWith(indicators);
        carouselEl.querySelector('.carousel-inner')?.replaceWith(inner);

        bs.carousel(carouselId);
    };

    /**
     * @param {ReturnType<typeof import('./storage.js').storage>} config
     * @returns {Promise<void>}
     */
    const apply = (config) => {
        Object.keys(slots).forEach((type) => {
            const url = config.get(`photo_${type}_url`);
            if (url) {
                setSlot(slots[type], url);
            }
        });

        return request(HTTP_GET, '/api/v2/gallery').token(session.getToken()).send()
            .then((res) => rebuildGallery(res.data))
            .catch(() => { });
    };

    return {
        apply,
    };
})();
