import { session } from './session.js';
import { request, HTTP_GET } from '../connection/request.js';

export const content = (() => {

    /**
     * @type {Record<string, string>}
     */
    let texts = {};

    /**
     * @param {string} key
     * @returns {string|null}
     */
    const get = (key) => {
        const value = texts[key];
        return typeof value === 'string' && value.length > 0 ? value : null;
    };

    /**
     * The stored value is "YYYY-MM-DD HH:MM" in the couple's own local time.
     * Built from its parts because new Date('2027-05-22 10:00') is parsed
     * inconsistently across browsers.
     *
     * @returns {Date|null}
     */
    const eventDate = () => {
        const raw = get('event_datetime');
        if (!raw) {
            return null;
        }

        const [datePart, timePart = '00:00'] = raw.trim().split(/[ T]/);
        const [year, month, day] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);

        const date = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    /**
     * Deliberately emptied, as opposed to never filled in. A key that was saved
     * blank means "show nothing here"; a key with no stored value at all leaves
     * the template wording alone.
     *
     * @param {string} key
     * @returns {boolean}
     */
    const isCleared = (key) => Object.prototype.hasOwnProperty.call(texts, key)
        && String(texts[key] ?? '').trim().length === 0;

    /**
     * Every text carrying a data-content marker, plus the copy buttons that
     * must keep showing the same value they display.
     *
     * @returns {void}
     */
    const applyTexts = () => {
        document.querySelectorAll('[data-content]').forEach((el) => {
            const key = el.getAttribute('data-content');

            if (isCleared(key)) {
                el.classList.add('d-none');
                return;
            }

            const value = get(key);
            if (value !== null) {
                el.textContent = value;
            }
        });

        // Some text sits inside a box that would be left as an empty shell -
        // an icon and a copy button, or colour swatches with no caption.
        document.querySelectorAll('[data-content-box]').forEach((el) => {
            if (isCleared(el.getAttribute('data-content-box'))) {
                el.classList.add('d-none');
            }
        });

        // Attributes rather than text: the welcome greeting is read from
        // data-message, and the venue button needs its href.
        document.querySelectorAll('[data-content-attr]').forEach((el) => {
            const [attribute, key] = String(el.getAttribute('data-content-attr')).split(':');
            const value = get(key);

            if (!attribute || !key || value === null) {
                return;
            }

            // A stored value ends up in an href, so only ordinary links are
            // allowed through - javascript: and data: URLs are not.
            if (attribute === 'href' && !/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(value)) {
                return;
            }

            el.setAttribute(attribute, value);
        });

        document.querySelectorAll('[data-content-copy]').forEach((el) => {
            const value = get(el.getAttribute('data-content-copy'));
            if (value !== null) {
                el.setAttribute('data-copy', value);
            }
        });
    };

    /**
     * One stored datetime drives the countdown, the printed date and the
     * calendar link, which the template previously hardcoded separately (and
     * inconsistently).
     *
     * @returns {void}
     */
    const applyEventDate = () => {
        const date = eventDate();
        if (!date) {
            return;
        }

        const pad = (n) => String(n).padStart(2, '0');
        document.body.setAttribute(
            'data-time',
            `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`,
        );

        // Only fill the printed date when it has not been written by hand.
        if (get('event_date_text') === null) {
            const formatted = date.toLocaleDateString(undefined, {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            });

            document.querySelectorAll('[data-content="event_date_text"]').forEach((el) => {
                el.textContent = formatted;
            });
        }
    };

    /**
     * @returns {{title: string, details: string, location: string, start: Date|null}}
     */
    const calendar = () => ({
        title: get('calendar_title') ?? (get('couple_display') ? `The Wedding of ${get('couple_display')}` : null),
        details: get('calendar_details') ?? get('invite_line'),
        location: get('venue_address'),
        start: eventDate(),
    });

    /**
     * The browser tab title. Kept separate from applyTexts because a <title>
     * is not an element applyTexts can reach with [data-content].
     *
     * @returns {void}
     */
    const applyTitle = () => {
        const title = get('page_title');
        if (title !== null) {
            document.title = title;
        }
    };

    /**
     * @returns {void}
     */
    const apply = () => {
        applyTexts();
        applyEventDate();
        applyTitle();
    };

    /**
     * @returns {Promise<void>}
     */
    const load = () => request(HTTP_GET, '/api/v2/content')
        .token(session.getToken())
        .send()
        .then((res) => {
            texts = res.data && typeof res.data === 'object' ? res.data : {};
        })
        .catch(() => {
            // Falling back to whatever the template already says is better than
            // rendering an invitation with holes in it.
            texts = {};
        });

    return {
        load,
        apply,
        get,
        calendar,
    };
})();
