import { util } from '../../common/util.js';
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
     * @returns {void}
     */
    const renderResponded = () => {
        const result = document.getElementById('rsvp-result');
        const attending = data.status === 'attending';

        const message = attending
            ? `We are delighted you can join us${data.guest_count > 1 ? `, all ${data.guest_count} of you` : ''}.`
            : 'Thank you for letting us know. You will be missed.';

        util.safeInnerHTML(result, `<i class="fa-solid ${attending ? 'fa-circle-check' : 'fa-circle-info'} fa-lg mb-2"></i><p class="m-0">${util.escapeHtml(message)}</p>`);
        result.classList.remove('d-none');
    };

    /**
     * @returns {void}
     */
    const applyState = () => {
        const form = document.getElementById('rsvp-form');
        const result = document.getElementById('rsvp-result');

        if (data.status === 'pending') {
            form.classList.remove('d-none');
            result.classList.add('d-none');
            return;
        }

        form.classList.add('d-none');
        renderResponded();
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
                ? `This invitation is for up to ${data.max_guests} people.`
                : '';
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
        getName,
        isActive,
    };
})();
