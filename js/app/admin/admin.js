import { auth } from './auth.js';
import { navbar } from './navbar.js';
import { contentFields } from './content-fields.js';
import { util } from '../../common/util.js';
import { dto } from '../../connection/dto.js';
import { theme } from '../../common/theme.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { offline } from '../../common/offline.js';
import { comment } from '../components/comment.js';
import { pool, request, HTTP_GET, HTTP_PATCH, HTTP_PUT, HTTP_POST, HTTP_DELETE } from '../../connection/request.js';

export const admin = (() => {

    /**
     * Personal invitation link for a guest token, derived from the dashboard URL.
     *
     * @param {string} token
     * @returns {string}
     */
    const guestLink = (token) => {
        const base = window.location.href.split('?')[0].split('#')[0].replace(/dashboard(\.html)?\/?$/, '');
        return `${base}?g=${token}`;
    };

    /**
     * @param {{id: number, name: string, token: string, max_guests: number, status: string, guest_count: number}[]} guests
     * @returns {void}
     */
    const renderGuestSummary = (guests) => {
        const attending = guests.filter((g) => g.status === 'attending');
        const declined = guests.filter((g) => g.status === 'declined');
        const pending = guests.filter((g) => g.status === 'pending');
        const heads = attending.reduce((sum, g) => sum + g.guest_count, 0);

        document.getElementById('guest-count-total').textContent = String(guests.length);
        document.getElementById('guest-count-attending').textContent = String(attending.length);
        document.getElementById('guest-count-declined').textContent = String(declined.length);
        document.getElementById('guest-count-pending').textContent = String(pending.length);
        document.getElementById('guest-headcount').textContent = `${heads} ${heads === 1 ? 'person is' : 'people are'} expected to attend.`;
    };

    /**
     * @param {number} id
     * @param {HTMLElement} row
     * @param {function} onDone
     * @returns {void}
     */
    const deleteGuest = (id, row, onDone) => {
        if (!util.ask('Are you sure?')) {
            return;
        }

        request(HTTP_DELETE, `/api/guest/${id}`)
            .token(session.getToken())
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                row.remove();
                onDone();
                util.notify('Success delete guest').success();
            });
    };

    /**
     * @param {{id: number, name: string, token: string, max_guests: number, status: string, guest_count: number}} guest
     * @param {function} onDelete
     * @returns {HTMLDivElement}
     */
    const renderGuestRow = (guest, onDelete) => {
        const badges = {
            attending: ['text-bg-success', 'Coming'],
            declined: ['text-bg-secondary', 'Declined'],
            pending: ['text-bg-warning', 'No reply'],
        };
        const [badgeClass, badgeText] = badges[guest.status] ?? badges.pending;

        const row = document.createElement('div');
        row.className = 'border rounded-4 p-2 mb-2';

        const top = document.createElement('div');
        top.className = 'd-flex justify-content-between align-items-center';

        const label = document.createElement('p');
        label.className = 'm-0 text-truncate me-2';
        label.style.fontSize = '0.9rem';
        label.textContent = guest.name;

        const badge = document.createElement('span');
        badge.className = `badge rounded-pill text-nowrap ${badgeClass}`;
        badge.textContent = guest.status === 'attending' && guest.guest_count > 1
            ? `${badgeText} (${guest.guest_count})`
            : badgeText;

        top.appendChild(label);
        top.appendChild(badge);

        const bottom = document.createElement('div');
        bottom.className = 'd-flex justify-content-between align-items-center mt-2';

        const seats = document.createElement('p');
        seats.className = 'm-0 small';
        seats.style.opacity = '0.75';
        seats.textContent = guest.max_guests === 1 ? '1 seat' : `${guest.max_guests} seats`;

        const actions = document.createElement('div');
        actions.className = 'd-flex gap-2';

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn btn-sm btn-outline-auto rounded-4 py-0';
        copyBtn.style.fontSize = '0.75rem';
        copyBtn.setAttribute('data-copy', guestLink(guest.token));
        copyBtn.setAttribute('data-offline-disabled', 'false');
        util.safeInnerHTML(copyBtn, '<i class="fa-solid fa-link me-1"></i>Copy link');
        copyBtn.onclick = () => util.copy(copyBtn);

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-sm btn-outline-auto rounded-4 py-0';
        delBtn.style.fontSize = '0.75rem';
        delBtn.setAttribute('data-offline-disabled', 'false');
        util.safeInnerHTML(delBtn, '<i class="fa-solid fa-trash-can"></i>');
        delBtn.onclick = () => onDelete(guest.id, row);

        actions.appendChild(copyBtn);
        actions.appendChild(delBtn);

        bottom.appendChild(seats);
        bottom.appendChild(actions);

        row.appendChild(top);
        row.appendChild(bottom);
        return row;
    };

    /**
     * @returns {void}
     */
    const loadGuestList = () => {
        request(HTTP_GET, '/api/guest').token(session.getToken()).send().then((res) => {
            const list = document.getElementById('guestList');
            list.replaceChildren();
            res.data.forEach((guest) => list.appendChild(
                renderGuestRow(guest, (id, row) => deleteGuest(id, row, loadGuestList))
            ));
            renderGuestSummary(res.data);
        });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const addGuest = (button) => {
        const name = document.getElementById('guestName');
        const max = document.getElementById('guestMax');

        if (name.value.trim().length === 0) {
            util.notify('Guest name cannot be empty').warning();
            return;
        }

        const btn = util.disableButton(button);

        request(HTTP_POST, '/api/guest')
            .token(session.getToken())
            .body({ name: name.value.trim(), max_guests: parseInt(max.value) || 1 })
            .send()
            .then(() => {
                name.value = '';
                max.value = '1';
                loadGuestList();
                util.notify('Success add guest').success();
            })
            // restore() and not restore(true): unlike the name/timezone/password
            // buttons there is no input handler to re-enable this one, so keeping
            // it disabled would allow only a single guest per page load.
            .finally(() => btn.restore());
    };

    /**
     * Builds the text editor from the manifest, so a new field only has to be
     * declared in content-fields.js and marked in index.html.
     *
     * @param {Record<string, string>} values
     * @returns {void}
     */
    const renderContentForm = (values) => {
        const root = document.getElementById('contentForm');
        root.replaceChildren();

        contentFields.forEach((section) => {
            const card = document.createElement('div');
            card.className = 'p-3 bg-theme-auto mb-3 rounded-4 shadow';

            const title = document.createElement('p');
            title.className = 'mx-0 mt-0 mb-3 p-0 fw-bold';
            util.safeInnerHTML(title, `<i class="fa-solid ${util.escapeHtml(section.icon)} me-2"></i>${util.escapeHtml(section.group)}`);
            card.appendChild(title);

            section.fields.forEach((field) => {
                const wrap = document.createElement('div');
                wrap.className = 'mb-3';

                const label = document.createElement('label');
                label.className = 'form-label small mb-1';
                label.setAttribute('for', `content-${field.key}`);
                label.textContent = field.label;
                wrap.appendChild(label);

                const input = document.createElement(field.type === 'area' ? 'textarea' : 'input');
                input.id = `content-${field.key}`;
                input.className = 'form-control form-control-sm rounded-4 shadow-sm';
                input.setAttribute('data-content-key', field.key);
                input.setAttribute('data-offline-disabled', 'false');

                if (field.type === 'area') {
                    input.rows = 4;
                } else {
                    input.type = field.type === 'datetime' ? 'datetime-local' : 'text';
                }

                input.value = values[field.key] ?? '';
                wrap.appendChild(input);

                if (field.hint) {
                    const hint = document.createElement('p');
                    hint.className = 'small mt-1 mb-0';
                    hint.style.opacity = '0.75';
                    hint.textContent = field.hint;
                    wrap.appendChild(hint);
                }

                card.appendChild(wrap);
            });

            root.appendChild(card);
        });
    };

    /**
     * @returns {void}
     */
    const loadContent = () => {
        request(HTTP_GET, '/api/content').token(session.getToken()).send().then((res) => {
            const values = { ...res.data };

            // datetime-local will not accept a space between date and time.
            if (values.event_datetime) {
                values.event_datetime = String(values.event_datetime).replace(' ', 'T').slice(0, 16);
            }

            renderContentForm(values);
        });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const saveContent = (button) => {
        const contents = {};

        document.querySelectorAll('[data-content-key]').forEach((el) => {
            let value = el.value.trim();

            // Store the datetime the way the invitation reads it back.
            if (el.type === 'datetime-local' && value.length > 0) {
                value = value.replace('T', ' ');
            }

            contents[el.getAttribute('data-content-key')] = value;
        });

        const btn = util.disableButton(button);

        request(HTTP_PUT, '/api/content')
            .token(session.getToken())
            .body({ contents })
            .send()
            .then(() => util.notify('Success save texts').success())
            .finally(() => btn.restore());
    };

    /**
     * @returns {Promise<void>}
     */
    const getUserStats = () => auth.getDetailUser().then((res) => {

        util.safeInnerHTML(document.getElementById('dashboard-name'), `${util.escapeHtml(res.data.name)}<i class="fa-solid fa-hands text-warning ms-2"></i>`);
        document.getElementById('dashboard-email').textContent = res.data.email;
        document.getElementById('dashboard-accesskey').value = res.data.access_key;
        document.getElementById('button-copy-accesskey').setAttribute('data-copy', res.data.access_key);

        document.getElementById('form-name').value = util.escapeHtml(res.data.name);
        document.getElementById('form-timezone').value = res.data.tz;
        document.getElementById('filterBadWord').checked = Boolean(res.data.is_filter);
        document.getElementById('confettiAnimation').checked = Boolean(res.data.is_confetti_animation);
        document.getElementById('replyComment').checked = Boolean(res.data.can_reply);
        document.getElementById('editComment').checked = Boolean(res.data.can_edit);
        document.getElementById('deleteComment').checked = Boolean(res.data.can_delete);
        document.getElementById('showHome').checked = Boolean(res.data.show_home);
        document.getElementById('showBride').checked = Boolean(res.data.show_bride);
        document.getElementById('showWeddingDate').checked = Boolean(res.data.show_wedding_date);
        document.getElementById('showGallery').checked = Boolean(res.data.show_gallery);
        document.getElementById('showComment').checked = Boolean(res.data.show_comment);
        document.getElementById('dashboard-tenorkey').value = res.data.tenor_key;
        document.getElementById('enableCustomTheme').checked = Boolean(res.data.is_custom_theme);
        document.getElementById('themePrimaryColor').value = res.data.theme_primary_color || '#0d6efd';
        document.getElementById('themeSecondaryColor').value = res.data.theme_secondary_color || '#6c757d';
        document.getElementById('themeBackgroundColor').value = res.data.theme_background_color || '#ffffff';
        document.getElementById('themeTextColor').value = res.data.theme_text_color || '#212529';
        document.getElementById('themeFont').value = res.data.theme_font || 'default';
        document.getElementById('rsvpDeadline').value = res.data.rsvp_deadline || '';

        loadGuestList();
        loadContent();

        storage('config').set('tenor_key', res.data.tenor_key);
        document.dispatchEvent(new Event('undangan.session'));

        request(HTTP_GET, '/api/stats').token(session.getToken()).withCache(1000 * 30).withForceCache().send().then((resp) => {
            document.getElementById('count-comment').textContent = String(resp.data.comments).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-like').textContent = String(resp.data.likes).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-present').textContent = String(resp.data.present).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            document.getElementById('count-absent').textContent = String(resp.data.absent).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        });

        comment.show();
    });

    /**
     * @param {HTMLElement} checkbox
     * @param {string} type
     * @returns {void}
     */
    const changeCheckboxValue = (checkbox, type) => {
        const label = util.disableCheckbox(checkbox);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({ [type]: checkbox.checked })
            .send()
            .finally(() => label.restore());
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const tenor = (button) => {
        const btn = util.disableButton(button);

        const form = document.getElementById('dashboard-tenorkey');
        form.disabled = true;

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({ tenor_key: form.value.length ? form.value : null })
            .send()
            .then(() => util.notify(`success ${form.value.length ? 'add' : 'remove'} tenor key`).success())
            .finally(() => {
                form.disabled = false;
                btn.restore();
            });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const regenerate = (button) => {
        if (!util.ask('Are you sure?')) {
            return;
        }

        const btn = util.disableButton(button);

        request(HTTP_PUT, '/api/key')
            .token(session.getToken())
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                getUserStats();
            })
            .finally(() => btn.restore());
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changePassword = (button) => {
        const old = document.getElementById('old_password');
        const newest = document.getElementById('new_password');

        if (old.value.length === 0 || newest.value.length === 0) {
            util.notify('Password cannot be empty').warning();
            return;
        }

        old.disabled = true;
        newest.disabled = true;

        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({
                old_password: old.value,
                new_password: newest.value,
            })
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                old.value = null;
                newest.value = null;
                util.notify('Success change password').success();
            })
            .finally(() => {
                btn.restore(true);

                old.disabled = false;
                newest.disabled = false;
            });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeName = (button) => {
        const name = document.getElementById('form-name');

        if (name.value.length === 0) {
            util.notify('Name cannot be empty').warning();
            return;
        }

        name.disabled = true;
        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({ name: name.value })
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                util.safeInnerHTML(document.getElementById('dashboard-name'), `${util.escapeHtml(name.value)}<i class="fa-solid fa-hands text-warning ms-2"></i>`);
                util.notify('Success change name').success();
            })
            .finally(() => {
                name.disabled = false;
                btn.restore(true);
            });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const download = (button) => {
        const btn = util.disableButton(button);
        request(HTTP_GET, '/api/download')
            .token(session.getToken())
            .withDownload('download', 'csv')
            .send()
            .finally(() => btn.restore());
    };

    /**
     * @returns {void}
     */
    const enableButtonName = () => {
        const btn = document.getElementById('button-change-name');
        if (btn.disabled) {
            btn.disabled = false;
        }
    };

    /**
     * @returns {void}
     */
    const enableButtonPassword = () => {
        const btn = document.getElementById('button-change-password');
        const old = document.getElementById('old_password');

        if (btn.disabled && old.value.length !== 0) {
            btn.disabled = false;
        }
    };

    /**
     * @param {HTMLFormElement} form 
     * @param {string|null} [query=null] 
     * @returns {void}
     */
    const openLists = (form, query = null) => {
        let timezones = Intl.supportedValuesOf('timeZone');
        const dropdown = document.getElementById('dropdown-tz-list');

        if (form.value && form.value.trim().length > 0) {
            timezones = timezones.filter((tz) => tz.toLowerCase().includes(form.value.trim().toLowerCase()));
        }

        if (query === null) {
            document.addEventListener('click', (e) => {
                if (!form.contains(e.currentTarget) && !dropdown.contains(e.currentTarget)) {
                    if (form.value.trim().length <= 0) {
                        form.setCustomValidity('Timezone cannot be empty.');
                        form.reportValidity();
                        return;
                    }

                    form.setCustomValidity('');
                    dropdown.classList.add('d-none');
                }
            }, { once: true, capture: true });
        }

        dropdown.replaceChildren();
        dropdown.classList.remove('d-none');

        timezones.slice(0, 20).forEach((tz) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action py-1 small';
            item.textContent = `${tz} (${util.getGMTOffset(tz)})`;
            item.onclick = () => {
                form.value = tz;
                dropdown.classList.add('d-none');
                document.getElementById('button-timezone').disabled = false;
            };
            dropdown.appendChild(item);
        });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeTz = (button) => {
        const tz = document.getElementById('form-timezone');

        if (tz.value.length === 0) {
            util.notify('Time zone cannot be empty').warning();
            return;
        }

        if (!Intl.supportedValuesOf('timeZone').includes(tz.value)) {
            util.notify('Timezone not supported').warning();
            return;
        }

        tz.disabled = true;
        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({ tz: tz.value })
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                util.notify('Success change tz').success();
            })
            .finally(() => {
                tz.disabled = false;
                btn.restore(true);
            });
    };


    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeRsvpDeadline = (button) => {
        const deadline = document.getElementById('rsvpDeadline');
        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({ rsvp_deadline: deadline.value })
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                util.notify(deadline.value.length ? 'Success change deadline' : 'Success remove deadline').success();
            })
            .finally(() => btn.restore());
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeAppearance = (button) => {
        const primary = document.getElementById('themePrimaryColor');
        const secondary = document.getElementById('themeSecondaryColor');
        const background = document.getElementById('themeBackgroundColor');
        const text = document.getElementById('themeTextColor');
        const font = document.getElementById('themeFont');

        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({
                theme_primary_color: primary.value,
                theme_secondary_color: secondary.value,
                theme_background_color: background.value,
                theme_text_color: text.value,
                theme_font: font.value,
            })
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                util.notify('Success change appearance').success();
            })
            // See addGuest: this button has no re-enable handler either, so it
            // must not be left disabled after a save.
            .finally(() => btn.restore());
    };

    /**
     * @returns {void}
     */
    const logout = () => {
        if (!util.ask('Are you sure?')) {
            return;
        }

        auth.clearSession();
    };

    /**
     * @returns {void}
     */
    const pageLoaded = () => {
        lang.init();
        lang.setDefault('en');

        comment.init();
        offline.init();
        theme.spyTop();

        document.addEventListener('hidden.bs.modal', getUserStats);

        const raw = window.location.hash.slice(1);
        if (raw.length > 0) {
            session.setToken(raw);
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        session.isValid() ? getUserStats() : auth.clearSession();
    };

    /**
     * @returns {object}
     */
    const init = () => {
        auth.init();
        theme.init();
        session.init();

        if (!session.isAdmin()) {
            storage('owns').clear();
            storage('likes').clear();
            storage('config').clear();
            storage('comment').clear();
            storage('session').clear();
            storage('information').clear();
        }

        window.addEventListener('load', () => pool.init(pageLoaded, ['gif']));

        return {
            util,
            theme,
            comment,
            admin: {
                auth,
                navbar,
                logout,
                tenor,
                download,
                regenerate,
                changeName,
                changePassword,
                changeCheckboxValue,
                changeAppearance,
                changeRsvpDeadline,
                saveContent,
                addGuest,
                enableButtonName,
                enableButtonPassword,
                openLists,
                changeTz,
            },
        };
    };

    return {
        init,
    };
})();