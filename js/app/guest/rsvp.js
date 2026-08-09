import { util } from '../../common/util.js';
import { content } from '../../common/content.js';
import { session } from '../../common/session.js';
import { storage } from '../../common/storage.js';
import { request, HTTP_GET, HTTP_POST } from '../../connection/request.js';

export const rsvp = (() => {

    /**
     * @type {string|null}
     */
    let token = null;

    /**
     * @type {{name: string, max_guests: number, status: string, guest_count: number}|null}
     */
    let data = null;

    /**
     * Pending choice, before it is submitted.
     *
     * @type {boolean|null}
     */
    let choice = null;


    /**
     * These sentences have values written into them, so they are stored with
     * {tokens} rather than as finished text. An emptied one falls back to the
     * wording below instead of disappearing - a blank confirmation box would
     * leave the guest with no idea whether their answer registered.
     *
     * @param {string} key
     * @param {string} fallback
     * @param {Record<string, string|number>} [vars={}]
     * @returns {string}
     */
    const phrase = (key, fallback, vars = {}) => {
        const template = content.get(key) ?? fallback;

        return Object.keys(vars).reduce(
            (acc, name) => acc.split(`{${name}}`).join(String(vars[name])),
            template,
        );
    };

    /**
     * @returns {boolean}
     */
    const isActive = () => data !== null;

    /**
     * @returns {string|null}
     */
    const getName = () => data?.name ?? null;

    /**
     * Keep the (hidden) attendance select in the wishes form in sync, so posting
     * a wish records the same answer the guest gave here.
     *
     * @returns {void}
     */
    const syncPresenceField = () => {
        const presence = document.getElementById('form-presence');
        if (!presence || !data) {
            return;
        }

        if (data.status === 'attending') {
            presence.value = '1';
        } else if (data.status === 'declined') {
            presence.value = '2';
        }

        if (data.status !== 'pending') {
            storage('information').set('presence', data.status === 'attending');
        }
    };

    /**
     * Built from the parts rather than parsed as a string, because
     * new Date('2030-06-01') is UTC midnight and renders as the previous day
     * for anyone west of Greenwich.
     *
     * @param {string} value
     * @returns {string}
     */
    const formatDeadline = (value) => {
        const [year, month, day] = String(value).split('-').map(Number);
        const date = new Date(year, month - 1, day);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    };

    /**
     * @param {string} message
     * @param {string} icon
     * @returns {void}
     */
    const renderMessage = (message, icon) => {
        util.safeInnerHTML(
            document.getElementById('rsvp-result-message'),
            `<i class="fa-solid ${icon} fa-lg mb-2"></i><p class="m-0">${util.escapeHtml(message)}</p>`,
        );
    };

    /**
     * @returns {void}
     */
    const applyState = () => {
        const form = document.getElementById('rsvp-form');
        const result = document.getElementById('rsvp-result');
        const change = document.getElementById('rsvp-change');
        const closed = data.can_respond === false;

        // Still open and nothing answered yet: straight to the form.
        if (!closed && data.status === 'pending') {
            form.classList.remove('d-none');
            result.classList.add('d-none');
            return;
        }

        form.classList.add('d-none');
        result.classList.remove('d-none');

        if (data.status === 'pending') {
            renderMessage(phrase('rsvp_closed_message', 'The date to reply has passed, so this invitation can no longer be answered.'), 'fa-circle-exclamation');
            change.classList.add('d-none');
            return;
        }

        const attending = data.status === 'attending';
        let message = phrase('rsvp_declined', 'Thank you for letting us know. You will be missed.');

        if (attending) {
            message = data.guest_count > 1
                ? phrase('rsvp_accepted_many', 'We are delighted you can join us, all {count} of you.', { count: data.guest_count })
                : phrase('rsvp_accepted', 'We are delighted you can join us.');
        }

        renderMessage(message, attending ? 'fa-circle-check' : 'fa-circle-info');

        // An answer can be revised right up until the deadline.
        change.classList.toggle('d-none', closed);
    };

    /**
     * @param {boolean} attending
     * @returns {void}
     */
    const choose = (attending) => {
        choice = attending;

        const yes = document.getElementById('rsvp-yes');
        const no = document.getElementById('rsvp-no');

        yes.classList.toggle('active', attending);
        no.classList.toggle('active', !attending);

        const wrapper = document.getElementById('rsvp-count-wrapper');
        wrapper.classList.toggle('d-none', !attending || data.max_guests <= 1);

        document.getElementById('rsvp-submit').disabled = false;
    };

    /**
     * @returns {void}
     */
    const changeAnswer = () => {
        if (data.can_respond === false) {
            return;
        }

        document.getElementById('rsvp-result').classList.add('d-none');
        document.getElementById('rsvp-form').classList.remove('d-none');

        // Start from the answer they already gave.
        choose(data.status === 'attending');

        const count = document.getElementById('rsvp-count');
        if (count && data.guest_count > 0) {
            count.value = String(data.guest_count);
        }
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const submit = (button) => {
        if (choice === null) {
            util.notify('Please choose whether you can attend.').warning();
            return;
        }

        const count = document.getElementById('rsvp-count');
        const body = { attending: choice };

        if (choice) {
            body.guest_count = data.max_guests > 1 ? parseInt(count.value) : 1;
        }

        const btn = util.disableButton(button);

        request(HTTP_POST, `/api/v2/guest/${token}`)
            .token(session.getToken())
            .body(body)
            .send()
            .then((res) => {
                data = res.data;
                syncPresenceField();
                applyState();
                util.notify('Thank you for your response').success();
            })
            // On success the form is replaced by the confirmation anyway; on
            // failure the guest must be able to try again.
            .finally(() => btn.restore());
    };

    /**
     * @returns {void}
     */
    const show = () => {
        if (!isActive()) {
            return;
        }

        document.getElementById('rsvp')?.classList.remove('d-none');
        document.getElementById('form-presence-wrapper')?.classList.add('d-none');

        const greeting = document.getElementById('rsvp-greeting');
        if (greeting) {
            greeting.textContent = data.name;
        }

        const seats = document.getElementById('rsvp-seats');
        if (seats) {
            seats.textContent = data.max_guests > 1
                ? phrase('rsvp_seats_note', 'This invitation is for up to {count} people.', { count: data.max_guests })
                : '';
        }

        const note = document.getElementById('rsvp-deadline-note');
        if (note) {
            const has = Boolean(data.rsvp_deadline);
            note.classList.toggle('d-none', !has);

            if (has) {
                const when = formatDeadline(data.rsvp_deadline);

                note.textContent = data.can_respond === false
                    ? phrase('rsvp_closed_note', 'Replies closed on {date}.', { date: when })
                    : phrase('rsvp_deadline_note', 'Please reply by {date}. You can change your answer until then.', { date: when });
            }
        }

        const count = document.getElementById('rsvp-count');
        if (count) {
            count.replaceChildren();
            for (let i = 1; i <= data.max_guests; i++) {
                const option = document.createElement('option');
                option.value = String(i);
                option.textContent = i === 1 ? '1 person' : `${i} people`;
                count.appendChild(option);
            }

            count.value = String(data.guest_count > 0 ? data.guest_count : data.max_guests);
        }

        const name = document.getElementById('form-name');
        if (name && name.value.trim().length === 0) {
            name.value = data.name;
        }

        syncPresenceField();
        applyState();
    };

    /**
     * @param {string|null} value
     * @returns {Promise<void>}
     */
    const load = (value) => {
        if (!value) {
            return Promise.resolve();
        }

        token = value;

        return request(HTTP_GET, `/api/v2/guest/${value}`)
            .token(session.getToken())
            .send()
            .then((res) => {
                data = res.data;
            })
            .catch(() => {
                // An unknown or revoked token just falls back to the public invitation.
                data = null;
            });
    };

    return {
        load,
        show,
        choose,
        submit,
        changeAnswer,
        getName,
        isActive,
    };
})();
