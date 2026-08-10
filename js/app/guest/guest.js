import { video } from './video.js';
import { image } from './image.js';
import { audio } from './audio.js';
import { rsvp } from './rsvp.js';
import { content } from '../../common/content.js';
import { progress } from './progress.js';
import { util } from '../../common/util.js';
import { bs } from '../../libs/bootstrap.js';
import { loader } from '../../libs/loader.js';
import { theme } from '../../common/theme.js';
import { lang } from '../../common/language.js';
import { customTheme } from '../../common/custom-theme.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { offline } from '../../common/offline.js';
import { comment } from '../components/comment.js';
import * as confetti from '../../libs/confetti.js';
import { pool } from '../../connection/request.js';

export const guest = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let information = null;

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let config = null;

    /**
     * @returns {void}
     */
    const countDownDate = () => {
        const count = (new Date(document.body.getAttribute('data-time').replace(' ', 'T'))).getTime();

        /**
         * @param {number} num 
         * @returns {string}
         */
        const pad = (num) => num < 10 ? `0${num}` : `${num}`;

        const day = document.getElementById('day');
        const hour = document.getElementById('hour');
        const minute = document.getElementById('minute');
        const second = document.getElementById('second');
        const spoken = document.getElementById('countdown-text');

        const updateCountdown = () => {
            const distance = Math.abs(count - Date.now());

            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            // The day figure stands alone, so it reads better unpadded - "5",
            // not "05". The clock keeps its padding, which is what stops the
            // layout shifting every time a digit narrows.
            day.textContent = String(days);
            hour.textContent = pad(hours);
            minute.textContent = pad(minutes);
            second.textContent = pad(seconds);

            // The visible countdown carries no words at all, which tells a
            // screen reader nothing. This sentence is the only place the units
            // are named, and it stays translatable from the Texts page.
            if (spoken) {
                spoken.textContent = [
                    `${days} ${content.get('countdown_days') ?? 'days'}`,
                    `${hours} ${content.get('countdown_hours') ?? 'hours'}`,
                    `${minutes} ${content.get('countdown_minutes') ?? 'minutes'}`,
                    `${seconds} ${content.get('countdown_seconds') ?? 'seconds'}`,
                ].join(', ');
            }

            util.timeOut(updateCountdown, 1000 - (Date.now() % 1000));
        };

        util.timeOut(updateCountdown);
    };

    /**
     * @returns {void}
     */
    const showGuestName = () => {
        /**
         * Make sure "to=" is the last query string.
         * Ex. ulems.my.id/?id=some-uuid-here&to=name
         */
        const raw = window.location.search.split('to=');
        let name = null;

        if (raw.length > 1 && raw[1].length >= 1) {
            name = window.decodeURIComponent(raw[1]);
        }

        // A personal invitation link carries the name server-side, which wins
        // over anything passed in the query string.
        if (rsvp.isActive()) {
            name = rsvp.getName();
        }

        if (name) {
            const guestName = document.getElementById('guest-name');

            // The wording above the name can be set per guest - so one
            // invitation reads "Dear Mr." and the next "To the family of" -
            // and falls back to the invitation-wide message when it is not.
            const message = rsvp.getGreeting() ?? guestName?.getAttribute('data-message');

            const div = document.createElement('div');
            div.classList.add('m-2');

            const template = `<small class="mt-0 mb-1 mx-0 p-0">${util.escapeHtml(message)}</small><p class="m-0 p-0" style="font-size: 1.25rem">${util.escapeHtml(name)}</p>`;
            util.safeInnerHTML(div, template);

            guestName?.appendChild(div);
        }

        const form = document.getElementById('form-name');
        if (form) {
            form.value = information.get('name') ?? name;
        }
    };

    /**
     * @returns {Promise<void>}
     */
    const slide = async () => {
        const interval = 6000;
        const slides = document.querySelectorAll('.slide-desktop');

        if (!slides || slides.length === 0) {
            return;
        }

        const desktopEl = document.getElementById('root')?.querySelector('.d-sm-block');
        if (!desktopEl) {
            return;
        }

        desktopEl.dispatchEvent(new Event('undangan.slide.stop'));

        if (window.getComputedStyle(desktopEl).display === 'none') {
            return;
        }

        if (slides.length === 1) {
            await util.changeOpacity(slides[0], true);
            return;
        }

        let index = 0;
        for (const [i, s] of slides.entries()) {
            if (i === index) {
                s.classList.add('slide-desktop-active');
                await util.changeOpacity(s, true);
                break;
            }
        }

        let run = true;
        const nextSlide = async () => {
            await util.changeOpacity(slides[index], false);
            slides[index].classList.remove('slide-desktop-active');

            index = (index + 1) % slides.length;

            if (run) {
                slides[index].classList.add('slide-desktop-active');
                await util.changeOpacity(slides[index], true);
            }

            return run;
        };

        desktopEl.addEventListener('undangan.slide.stop', () => {
            run = false;
        });

        const loop = async () => {
            if (await nextSlide()) {
                util.timeOut(loop, interval);
            }
        };

        util.timeOut(loop, interval);
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const open = (button) => {
        button.disabled = true;
        document.body.scrollIntoView({ behavior: 'instant' });
        document.getElementById('root').classList.remove('opacity-0');

        if (theme.isAutoMode() && !customTheme.isActive()) {
            document.getElementById('button-theme').classList.remove('d-none');
        }

        slide();
        theme.spyTop();

        confetti.basicAnimation();
        util.timeOut(confetti.openAnimation, 1500);

        document.dispatchEvent(new Event('undangan.open'));
        util.changeOpacity(document.getElementById('welcome'), false).then((el) => el.remove());
    };

    /**
     * @param {HTMLImageElement} img
     * @returns {void}
     */
    const modal = (img) => {
        document.getElementById('button-modal-click').setAttribute('href', img.src);
        document.getElementById('button-modal-download').setAttribute('data-src', img.src);

        const i = document.getElementById('show-modal-image');
        i.src = img.src;
        i.width = img.width;
        i.height = img.height;
        bs.modal('modal-image').show();
    };

    /**
     * @returns {void}
     */
    const modalImageClick = () => {
        document.getElementById('show-modal-image').addEventListener('click', (e) => {
            const abs = e.currentTarget.parentNode.querySelector('.position-absolute');

            abs.classList.contains('d-none')
                ? abs.classList.replace('d-none', 'd-flex')
                : abs.classList.replace('d-flex', 'd-none');
        });
    };

    /**
     * @param {HTMLDivElement} div 
     * @returns {void}
     */
    const showStory = (div) => {
        if (navigator.vibrate) {
            navigator.vibrate(500);
        }

        confetti.tapTapAnimation(div, 100);
        util.changeOpacity(div, false).then((e) => e.remove());
    };

    /**
     * @returns {void}
     */
    const closeInformation = () => information.set('info', true);

    /**
     * @returns {void}
     */
    const normalizeArabicFont = () => {
        document.querySelectorAll('.font-arabic').forEach((el) => {
            el.innerHTML = String(el.innerHTML).normalize('NFC');
        });
    };

    /**
     * @returns {void}
     */
    const animateSvg = () => {
        document.querySelectorAll('svg').forEach((el) => {
            if (el.hasAttribute('data-class')) {
                util.timeOut(() => el.classList.add(el.getAttribute('data-class')), parseInt(el.getAttribute('data-time')));
            }
        });
    };

    /**
     * @returns {void}
     */
    const buildGoogleCalendar = () => {
        const event = content.calendar();

        // Without a stored date there is nothing meaningful to add to a calendar,
        // so leave the button inert rather than linking to a wrong year.
        if (!event.start) {
            return;
        }

        /**
         * @param {Date} d
         * @returns {string}
         */
        const stamp = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
        };

        // One hour long, and left floating so Google reads it in ctz below.
        const end = new Date(event.start.getTime() + (60 * 60 * 1000));

        const url = new URL('https://calendar.google.com/calendar/render');
        const data = new URLSearchParams({
            action: 'TEMPLATE',
            text: event.title ?? 'Wedding',
            dates: `${stamp(event.start)}/${stamp(end)}`,
            ctz: config.get('tz'),
        });

        if (event.details) {
            data.set('details', event.details);
        }

        if (event.location) {
            data.set('location', event.location);
        }

        url.search = data.toString();
        document.querySelector('#home button')?.addEventListener('click', () => window.open(url, '_blank'));
    };

    /**
     * @param {string} id
     * @param {boolean} show
     * @returns {void}
     */
    const toggleInvitationSection = (id, show) => {
        document.getElementById(id)?.classList.toggle('d-none', !show);
        document.querySelector(`a.nav-link[href="#${id}"]`)?.closest('li')?.classList.toggle('d-none', !show);
    };

    /**
     * @returns {void}
     */
    const applyInvitationVisibility = () => {
        toggleInvitationSection('home', config.get('show_home') !== false);
        toggleInvitationSection('bride', config.get('show_bride') !== false);
        toggleInvitationSection('wedding-date', config.get('show_wedding_date') !== false);
        toggleInvitationSection('gallery', config.get('show_gallery') !== false);
        toggleInvitationSection('story', config.get('show_story') !== false);
        toggleInvitationSection('gift', config.get('show_gift') !== false);
        toggleInvitationSection('dresscode', config.get('show_dresscode') !== false);
        toggleInvitationSection('comment', config.get('show_comment') !== false);
    };

    /**
     * @returns {object}
     */
    const loaderLibs = () => {
        progress.add();

        /**
         * @param {{aos: boolean, confetti: boolean}} opt
         * @returns {void}
         */
        const load = (opt) => {
            loader(opt)
                .then(() => progress.complete('libs'))
                .catch(() => progress.invalid('libs'));
        };

        return {
            load,
        };
    };

    /**
     * @returns {Promise<void>}
     */
    const booting = async () => {
        // Before countDownDate() and buildGoogleCalendar(), which both read
        // values that the stored content may have just replaced.
        content.apply();

        // After content.apply(): "auto" direction reads the invitation's own
        // words, which are only in the DOM once the stored text has landed.
        customTheme.applyDirection(config);

        animateSvg();
        countDownDate();
        showGuestName();
        modalImageClick();
        normalizeArabicFont();
        buildGoogleCalendar();

        if (information.has('presence')) {
            document.getElementById('form-presence').value = information.get('presence') ? '1' : '2';
        }

        // After the presence restore above, so a personal invitation's answer wins.
        rsvp.show();

        if (information.get('info')) {
            document.getElementById('information')?.remove();
        }

        // wait until welcome screen is show.
        await util.changeOpacity(document.getElementById('welcome'), true);

        // remove loading screen and show welcome screen.
        await util.changeOpacity(document.getElementById('loading'), false).then((el) => el.remove());
    };

    /**
     * @returns {void}
     */
    const pageLoaded = () => {
        lang.init();
        offline.init();
        comment.init();
        progress.init();

        config = storage('config');
        information = storage('information');

        const vid = video.init();
        const img = image.init();
        const aud = audio.init();
        const lib = loaderLibs();
        const token = document.body.getAttribute('data-key');
        const params = new URLSearchParams(window.location.search);

        window.addEventListener('resize', util.debounce(slide));
        document.addEventListener('undangan.progress.done', () => booting());
        document.addEventListener('hide.bs.modal', () => document.activeElement?.blur());
        document.getElementById('button-modal-download').addEventListener('click', (e) => {
            img.download(e.currentTarget.getAttribute('data-src'));
        });

        if (!token || token.length <= 0) {
            document.getElementById('comment')?.remove();
            document.querySelector('a.nav-link[href="#comment"]')?.closest('li')?.remove();

            vid.load();
            img.load();
            aud.load();
            lib.load({ confetti: document.body.getAttribute('data-confetti') === 'true' });
        }

        if (token && token.length > 0) {
            // add 4 progress for config, comment, the personal invitation
            // and the editable texts.
            // before img.load();
            progress.add();
            progress.add();
            progress.add();
            progress.add();

            // if don't have data-src.
            if (!img.hasDataSrc()) {
                img.load();
            }

            session.guest(params.get('k') ?? token).then(({ data }) => {
                document.dispatchEvent(new Event('undangan.session'));
                progress.complete('config');
                applyInvitationVisibility();
                customTheme.apply(config);

                // Resolved before booting() so the guest's name is ready by the
                // time the welcome screen is rendered.
                rsvp.load(params.get('g'))
                    .then(() => progress.complete('guest'))
                    .catch(() => progress.complete('guest'));

                content.load()
                    .then(() => progress.complete('content'))
                    .catch(() => progress.complete('content'));

                if (img.hasDataSrc()) {
                    img.load();
                }

                vid.load();
                aud.load();
                lib.load({ confetti: data.is_confetti_animation });

                if (data.show_comment !== false) {
                    comment.show()
                        .then(() => progress.complete('comment'))
                        .catch(() => progress.invalid('comment'));
                } else {
                    progress.complete('comment');
                }

            }).catch(() => progress.invalid('config'));
        }
    };

    /**
     * @returns {object}
     */
    const init = () => {
        theme.init();
        session.init();

        if (session.isAdmin()) {
            storage('user').clear();
            storage('owns').clear();
            storage('likes').clear();
            storage('session').clear();
            storage('comment').clear();
        }

        window.addEventListener('load', () => {
            pool.init(pageLoaded, [
                'image',
                'video',
                'audio',
                'libs',
                'gif',
            ]);
        });

        return {
            util,
            theme,
            comment,
            guest: {
                open,
                modal,
                showStory,
                closeInformation,
                rsvpChoose: rsvp.choose,
                rsvpSubmit: rsvp.submit,
                rsvpChange: rsvp.changeAnswer,
            },
        };
    };

    return {
        init,
    };
})();