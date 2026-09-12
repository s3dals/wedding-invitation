import { auth } from './auth.js';
import { navbar } from './navbar.js';
import { contentFields } from './content-fields.js';
import { themePresets } from './theme-presets.js';
import { util } from '../../common/util.js';
import { dto } from '../../connection/dto.js';
import { theme } from '../../common/theme.js';
import { lang } from '../../common/language.js';
import { storage } from '../../common/storage.js';
import { session } from '../../common/session.js';
import { customTheme } from '../../common/custom-theme.js';
import { offline } from '../../common/offline.js';
import { comment } from '../components/comment.js';
import { pool, request, HTTP_GET, HTTP_PATCH, HTTP_PUT, HTTP_POST, HTTP_DELETE, HTTP_STATUS_OK } from '../../connection/request.js';

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
     * @param {{id: number, name: string, greeting: string|null, token: string, max_guests: number, status: string, guest_count: number}[]} guests
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
     * Swaps the row's contents for an inline form. Editing in place rather
     * than in a dialog keeps the guest being changed visible in the list.
     *
     * @param {{id: number, name: string, greeting: string|null, max_guests: number}} guest
     * @param {HTMLElement} row
     * @param {{onCancel: function, onSaved: function}} handlers
     * @returns {void}
     */
    const renderGuestEdit = (guest, row, handlers) => {
        const field = (label, input) => {
            const wrap = document.createElement('div');
            const tag = document.createElement('label');
            tag.className = 'form-label small mb-1';
            tag.textContent = label;
            wrap.appendChild(tag);
            wrap.appendChild(input);
            return wrap;
        };

        const greeting = document.createElement('input');
        greeting.type = 'text';
        greeting.className = 'form-control form-control-sm rounded-4';
        greeting.maxLength = 100;
        greeting.placeholder = 'e.g. Dear Mr., To the family of';
        greeting.value = guest.greeting ?? '';

        const name = document.createElement('input');
        name.type = 'text';
        name.className = 'form-control form-control-sm rounded-4';
        name.maxLength = 100;
        name.value = guest.name;

        const max = document.createElement('input');
        max.type = 'number';
        max.className = 'form-control form-control-sm rounded-4';
        max.min = '1';
        max.max = '20';
        max.value = String(guest.max_guests);

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'btn btn-sm btn-outline-auto rounded-4';
        cancelBtn.style.fontSize = '0.75rem';
        cancelBtn.setAttribute('data-offline-disabled', 'false');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = () => handlers.onCancel();

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'btn btn-sm btn-primary rounded-4';
        saveBtn.style.fontSize = '0.75rem';
        saveBtn.setAttribute('data-offline-disabled', 'false');
        saveBtn.textContent = 'Save';
        saveBtn.onclick = () => {
            if (name.value.trim().length === 0) {
                util.notify('Guest name cannot be empty').warning();
                return;
            }

            const btn = util.disableButton(saveBtn);

            request(HTTP_PATCH, `/api/guest/${guest.id}`)
                .token(session.getToken())
                .body({
                    name: name.value.trim(),
                    // Always sent, so clearing the box is what removes a
                    // greeting - the field is only skipped when absent.
                    greeting: greeting.value.trim(),
                    max_guests: parseInt(max.value) || 1,
                })
                .send()
                .then(() => {
                    handlers.onSaved();
                    util.notify('Success update guest').success();
                })
                // The form stays on screen when the request fails, so the
                // button has to come back for a second attempt.
                .finally(() => btn.restore());
        };

        const actions = document.createElement('div');
        actions.className = 'd-flex justify-content-end gap-2 mt-3';
        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);

        const form = document.createElement('div');
        form.className = 'd-flex flex-column gap-2';
        form.appendChild(field('Greeting above the name (optional)', greeting));
        form.appendChild(field('Guest or family name', name));
        form.appendChild(field('Seats', max));
        form.appendChild(actions);

        row.replaceChildren(form);
        name.focus();
    };

    /**
     * @param {{id: number, name: string, greeting: string|null, token: string, max_guests: number, status: string, guest_count: number}} guest
     * @param {HTMLElement} row
     * @param {{onDelete: function, onSaved: function}} handlers
     * @returns {HTMLElement}
     */
    const renderGuestRow = (guest, row, handlers) => {
        const badges = {
            attending: ['text-bg-success', 'Coming'],
            declined: ['text-bg-secondary', 'Declined'],
            pending: ['text-bg-warning', 'No reply'],
        };
        const [badgeClass, badgeText] = badges[guest.status] ?? badges.pending;

        const top = document.createElement('div');
        top.className = 'd-flex justify-content-between align-items-center';

        const label = document.createElement('div');
        label.className = 'text-truncate me-2';

        // The greeting sits above the name here exactly as it does on the
        // invitation, so the owner can check at a glance that the wording
        // matches the guest it was written for.
        if (guest.greeting) {
            const prefix = document.createElement('p');
            prefix.className = 'm-0 small';
            prefix.style.opacity = '0.75';
            prefix.textContent = guest.greeting;
            label.appendChild(prefix);
        }

        const who = document.createElement('p');
        who.className = 'm-0';
        who.style.fontSize = '0.9rem';
        who.textContent = guest.name;
        label.appendChild(who);

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

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn btn-sm btn-outline-auto rounded-4 py-0';
        editBtn.style.fontSize = '0.75rem';
        editBtn.setAttribute('data-offline-disabled', 'false');
        util.safeInnerHTML(editBtn, '<i class="fa-solid fa-pen"></i>');
        editBtn.onclick = () => renderGuestEdit(guest, row, {
            // Cancelling redraws the row from the guest as it was, so nothing
            // typed into the abandoned form survives.
            onCancel: () => renderGuestRow(guest, row, handlers),
            onSaved: handlers.onSaved,
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn btn-sm btn-outline-auto rounded-4 py-0';
        delBtn.style.fontSize = '0.75rem';
        delBtn.setAttribute('data-offline-disabled', 'false');
        util.safeInnerHTML(delBtn, '<i class="fa-solid fa-trash-can"></i>');
        delBtn.onclick = () => handlers.onDelete(guest.id, row);

        actions.appendChild(copyBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        bottom.appendChild(seats);
        bottom.appendChild(actions);

        // Show the personal invitation link inline under the name so the
        // owner can see it (and open it) instead of only copying it blind.
        const url = guestLink(guest.token);
        const linkRow = document.createElement('div');
        linkRow.className = 'mt-1';

        const link = document.createElement('a');
        link.className = 'd-block text-truncate';
        link.style.fontSize = '0.72rem';
        link.style.opacity = '0.7';
        link.style.textDecoration = 'none';
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = url;
        link.textContent = url;
        linkRow.appendChild(link);

        row.replaceChildren(top, linkRow, bottom);
        return row;
    };

    /**
     * @returns {void}
     */
    const loadGuestList = () => {
        request(HTTP_GET, '/api/guest').token(session.getToken()).send().then((res) => {
            const list = document.getElementById('guestList');
            list.replaceChildren();

            res.data.forEach((guest) => {
                const row = document.createElement('div');
                row.className = 'border rounded-4 p-2 mb-2';

                list.appendChild(renderGuestRow(guest, row, {
                    onDelete: (id, target) => deleteGuest(id, target, loadGuestList),
                    // A saved edit can clamp guest_count down to the new seat
                    // count, so the summary is refetched rather than patched.
                    onSaved: loadGuestList,
                }));
            });

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
        const greeting = document.getElementById('guestGreeting');

        if (name.value.trim().length === 0) {
            util.notify('Guest name cannot be empty').warning();
            return;
        }

        const btn = util.disableButton(button);

        request(HTTP_POST, '/api/guest')
            .token(session.getToken())
            .body({
                name: name.value.trim(),
                greeting: greeting.value.trim(),
                max_guests: parseInt(max.value) || 1,
            })
            .send()
            .then(() => {
                name.value = '';
                max.value = '1';
                // The wording usually repeats across a run of guests, so it is
                // left in place rather than cleared with the rest of the form.
                loadGuestList();
                util.notify('Success add guest').success();
            })
            // restore() and not restore(true): unlike the name/timezone/password
            // buttons there is no input handler to re-enable this one, so keeping
            // it disabled would allow only a single guest per page load.
            .finally(() => btn.restore());
    };

    /**
     * The sticky save bar sits above the fixed bottom navigation, so it needs
     * that bar's height. Measured rather than hardcoded: the value changes with
     * the user's font size, and goes to zero at the breakpoint where the
     * navigation is hidden.
     *
     * @returns {void}
     */
    const trackBottomNavHeight = () => {
        const nav = document.querySelector('nav.fixed-bottom');

        // offsetHeight is 0 once the bar is hidden at md and up, which is
        // exactly the offset wanted there.
        const measure = () => document.documentElement.style.setProperty(
            '--admin-bottom-nav',
            `${nav?.offsetHeight ?? 0}px`,
        );

        measure();
        window.addEventListener('resize', measure);
    };

    /**
     * Tracks whether the text form has edits the server has not seen. The
     * save bar is always on screen now, so it may as well say whether pressing
     * it would do anything.
     *
     * @param {boolean} dirty
     * @returns {void}
     */
    const markContentDirty = (dirty) => {
        const hint = document.getElementById('contentSaveHint');
        if (!hint) {
            return;
        }

        hint.textContent = dirty ? 'Unsaved changes' : 'No changes yet';
        hint.classList.toggle('fw-semibold', dirty);
        hint.style.opacity = dirty ? '1' : '0.75';
    };

    /**
     * Builds the text editor from the manifest, so a new field only has to be
     * declared in content-fields.js and marked in index.html.
     *
     * @param {Record<string, string>} values
     * @param {Record<string, string>} defaults
     * @returns {void}
     */
    const renderContentForm = (values, defaults) => {
        const root = document.getElementById('contentForm');
        root.replaceChildren();

        // Assigned rather than added, so rebuilding the form cannot stack up
        // duplicate listeners on the container.
        root.oninput = () => markContentDirty(true);
        markContentDirty(false);
        trackBottomNavHeight();

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

                // Prefilled with whatever the invitation currently shows, so that
                // clearing a box is a deliberate act meaning "show nothing here"
                // rather than being indistinguishable from never touching it.
                const stored = Object.prototype.hasOwnProperty.call(values, field.key);
                const fallback = field.type === 'datetime' ? '' : (defaults[field.key] ?? '');

                input.value = stored ? (values[field.key] ?? '') : fallback;

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
     * The wording the invitation falls back to when a box is left empty, read
     * from the page itself so the hints cannot drift from the template.
     *
     * @returns {Promise<Record<string, string>>}
     */
    const loadContentDefaults = () => {
        const url = window.location.href.split('?')[0].split('#')[0].replace(/dashboard(\.html)?\/?$/, '');

        return window.fetch(url)
            .then((res) => res.text())
            .then((html) => {
                const doc = new DOMParser().parseFromString(html, 'text/html');
                const defaults = {};

                doc.querySelectorAll('[data-content]').forEach((el) => {
                    const key = el.getAttribute('data-content');
                    const text = el.textContent.trim().replace(/\s+/g, ' ');

                    if (!defaults[key] && text.length > 0) {
                        defaults[key] = text;
                    }
                });

                // Some texts live in an attribute rather than in the element,
                // and must prefill too - saving an empty box would otherwise
                // wipe the link or greeting they hold.
                doc.querySelectorAll('[data-content-attr]').forEach((el) => {
                    const [attribute, key] = String(el.getAttribute('data-content-attr')).split(':');
                    const value = attribute ? (el.getAttribute(attribute) ?? '').trim() : '';

                    if (key && !defaults[key] && value.length > 0) {
                        defaults[key] = value;
                    }
                });

                return defaults;
            })
            .catch(() => ({}));
    };

    /**
     * @returns {void}
     */
    const loadContent = () => {
        Promise.all([
            request(HTTP_GET, '/api/content').token(session.getToken()).send(),
            loadContentDefaults(),
        ]).then(([res, defaults]) => {
            const values = { ...res.data };

            // datetime-local will not accept a space between date and time.
            if (values.event_datetime) {
                values.event_datetime = String(values.event_datetime).replace(' ', 'T').slice(0, 16);
            }

            renderContentForm(values, defaults);
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
            .then(() => {
                markContentDirty(false);
                util.notify('Success save texts').success();
            })
            .finally(() => btn.restore());
    };

    /**
     * Warns, never blocks. A deliberately soft watermark is a valid choice; a
     * button nobody can read is not, and until now nothing said which was which.
     *
     * @returns {void}
     */
    const renderContrastReport = () => {
        const root = document.getElementById('contrastReport');
        if (!root) {
            return;
        }

        const background = document.getElementById('themeBackgroundColor').value;
        const text = document.getElementById('themeTextColor').value;
        const primary = document.getElementById('themePrimaryColor').value;

        const checks = [
            { label: 'Text on background', ratio: customTheme.contrast(text, background), min: 4.5 },
            { label: 'Button label', ratio: customTheme.contrast(customTheme.readableOn(primary), primary), min: 4.5 },
        ];

        root.replaceChildren();

        checks.forEach((check) => {
            const ok = check.ratio >= check.min;

            const line = document.createElement('p');
            line.className = `small m-0 mt-1 px-2 py-1 rounded-3 ${ok ? 'text-bg-success' : 'text-bg-warning'}`;
            line.textContent = ok
                ? `${check.label}: ${check.ratio.toFixed(1)}:1 — easy to read`
                : `${check.label}: ${check.ratio.toFixed(1)}:1 — may be hard to read`;

            root.appendChild(line);
        });
    };

    /**
     * @returns {void}
     */
    const renderThemePresets = () => {
        const root = document.getElementById('themePresets');
        if (!root) {
            return;
        }

        root.replaceChildren();

        themePresets.forEach((preset) => {
            const col = document.createElement('div');
            col.className = 'col-6 col-md-4';

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'btn w-100 rounded-4 shadow-sm border py-2 px-1';
            card.style.backgroundColor = preset.background;
            card.style.color = preset.text;
            card.style.fontSize = '0.75rem';
            card.setAttribute('data-offline-disabled', 'false');

            const swatches = document.createElement('span');
            swatches.className = 'd-flex justify-content-center gap-1 mb-1';

            [preset.background, preset.primary, preset.text].forEach((colour) => {
                const dot = document.createElement('span');
                dot.className = 'd-block rounded-circle border';
                dot.style.width = '0.9rem';
                dot.style.height = '0.9rem';
                dot.style.backgroundColor = colour;
                swatches.appendChild(dot);
            });

            const name = document.createElement('span');
            name.className = 'd-block fw-semibold';
            name.textContent = preset.name;

            card.appendChild(swatches);
            card.appendChild(name);

            // Fills the inputs and leaves them editable - a starting point, not
            // a lock. Nothing is saved until Save is pressed.
            card.onclick = () => {
                document.getElementById('themePrimaryColor').value = preset.primary;
                document.getElementById('themeSecondaryColor').value = preset.secondary;
                document.getElementById('themeBackgroundColor').value = preset.background;
                document.getElementById('themeTextColor').value = preset.text;
                document.getElementById('themeDividerColor').value = preset.text;
                document.getElementById('enableCustomTheme').checked = true;
                renderContrastReport();
                util.notify(`${preset.name} loaded — press Save to keep it`).info();
            };

            col.appendChild(card);
            root.appendChild(col);
        });
    };

    /**
     * Dividers follow the text colour unless something else is chosen, so
     * "match" is simply setting them equal again.
     *
     * @returns {void}
     */
    const resetDividerColour = () => {
        document.getElementById('themeDividerColor').value = document.getElementById('themeTextColor').value;
        renderContrastReport();
    };

    /**
     * Shrinks the picture in the browser before it is ever sent.
     *
     * A photo straight off a phone is several megabytes, and the API runs behind
     * a 4.5 MB request-body ceiling - so this is what makes "just pick a photo"
     * work rather than fail on the way out. webp at 1400px long edge lands at a
     * few hundred kB for a photograph.
     *
     * @param {File} file
     * @returns {Promise<{data: string, type: string, bytes: number}>}
     */
    const shrinkImage = (file) => new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('That file could not be read as an image.'));
        };

        img.onload = () => {
            URL.revokeObjectURL(url);

            const longest = Math.max(img.naturalWidth, img.naturalHeight);
            const scale = longest > 1400 ? 1400 / longest : 1;

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.naturalWidth * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('The image could not be converted.'));
                    return;
                }

                const reader = new FileReader();
                reader.onerror = () => reject(new Error('The image could not be read back.'));
                reader.onload = () => resolve({
                    // Strip the "data:image/webp;base64," prefix; the API stores
                    // the payload and the type separately.
                    data: String(reader.result).split(',')[1],
                    type: blob.type,
                    bytes: blob.size,
                });
                reader.readAsDataURL(blob);
            }, 'image/webp', 0.82);
        };

        img.src = url;
    });

    /**
     * @param {string|null} version
     * @returns {void}
     */
    const showCouplePhoto = (version) => {
        const preview = document.getElementById('couplePhotoPreview');
        const remove = document.getElementById('couplePhotoRemove');

        if (!version) {
            preview.classList.add('d-none');
            preview.removeAttribute('src');
            remove.classList.add('d-none');
            return;
        }

        const url = new URL('api/v2/photo', document.body.getAttribute('data-url'));
        url.searchParams.set('key', document.getElementById('dashboard-accesskey').value);
        url.searchParams.set('v', version);

        preview.src = url.toString();
        preview.classList.remove('d-none');
        remove.classList.remove('d-none');
    };

    /**
     * @param {HTMLInputElement} input
     * @returns {Promise<void>}
     */
    const uploadCouplePhoto = async (input) => {
        const file = input.files?.[0];
        if (!file) {
            return;
        }

        const hint = document.getElementById('couplePhotoHint');
        hint.textContent = 'Preparing the photo...';
        input.disabled = true;

        try {
            const image = await shrinkImage(file);
            hint.textContent = `Uploading ${Math.round(image.bytes / 1024)} kB...`;

            const res = await request(HTTP_POST, '/api/photo')
                .token(session.getToken())
                .body({ data: image.data, type: image.type })
                .send();

            if (res.code !== HTTP_STATUS_OK) {
                throw new Error(res.error?.[0] ?? 'The upload was refused.');
            }

            showCouplePhoto(res.data.version);
            hint.textContent = 'Saved. Guests will see it straight away.';
        } catch (err) {
            hint.textContent = err.message;
            util.notify(err.message).error();
        } finally {
            input.disabled = false;
            input.value = '';
        }
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    const removeCouplePhoto = async (button) => {
        const btn = util.disableButton(button);
        const hint = document.getElementById('couplePhotoHint');

        try {
            const res = await request(HTTP_DELETE, '/api/photo').token(session.getToken()).send();

            if (res.code !== HTTP_STATUS_OK) {
                throw new Error(res.error?.[0] ?? 'The photo could not be removed.');
            }

            showCouplePhoto(null);
            hint.textContent = 'Removed.';
        } catch (err) {
            hint.textContent = err.message;
            util.notify(err.message).error();
        } finally {
            btn.restore();
        }
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
        document.getElementById('showStory').checked = res.data.show_story !== false;
        document.getElementById('showGift').checked = res.data.show_gift !== false;
        document.getElementById('showDresscode').checked = res.data.show_dresscode !== false;
        document.getElementById('showComment').checked = Boolean(res.data.show_comment);
        document.getElementById('dashboard-tenorkey').value = res.data.tenor_key;
        document.getElementById('enableCustomTheme').checked = Boolean(res.data.is_custom_theme);
        document.getElementById('themePrimaryColor').value = res.data.theme_primary_color || '#0d6efd';
        document.getElementById('themeSecondaryColor').value = res.data.theme_secondary_color || '#6c757d';
        document.getElementById('themeBackgroundColor').value = res.data.theme_background_color || '#ffffff';
        document.getElementById('themeTextColor').value = res.data.theme_text_color || '#212529';
        document.getElementById('themeFont').value = res.data.theme_font || 'default';
        document.getElementById('themeFontArabic').value = res.data.theme_font_arabic || 'default';
        document.getElementById('themeDirection').value = res.data.theme_direction || 'auto';
        // No stored divider colour means it follows the text colour.
        document.getElementById('themeDividerColor').value = res.data.theme_divider_color || res.data.theme_text_color || '#212529';

        // Only the version travels in this response; the image itself is fetched
        // from its own cacheable URL.
        showCouplePhoto(res.data.photo_couple_version);

        renderThemePresets();
        renderContrastReport();

        ['themePrimaryColor', 'themeBackgroundColor', 'themeTextColor'].forEach((id) => {
            document.getElementById(id).addEventListener('input', renderContrastReport);
        });
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
        const divider = document.getElementById('themeDividerColor');
        const text = document.getElementById('themeTextColor');

        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({
                theme_primary_color: document.getElementById('themePrimaryColor').value,
                theme_secondary_color: document.getElementById('themeSecondaryColor').value,
                theme_background_color: document.getElementById('themeBackgroundColor').value,
                theme_text_color: text.value,
                // Sending an empty string is how the dividers go back to
                // following the text colour.
                theme_divider_color: divider.value === text.value ? '' : divider.value,
            })
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                util.notify('Success change colours').success();
            })
            // See addGuest: this button has no re-enable handler either, so it
            // must not be left disabled after a save.
            .finally(() => btn.restore());
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeFonts = (button) => {
        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({
                theme_font: document.getElementById('themeFont').value,
                theme_font_arabic: document.getElementById('themeFontArabic').value,
            })
            .send(dto.statusResponse)
            .then((res) => {
                if (res.data.status) {
                    util.notify('Success change fonts').success();
                }
            })
            .finally(() => btn.restore());
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const changeDirection = (button) => {
        const btn = util.disableButton(button);

        request(HTTP_PATCH, '/api/user')
            .token(session.getToken())
            .body({ theme_direction: document.getElementById('themeDirection').value })
            .send(dto.statusResponse)
            .then((res) => {
                if (res.data.status) {
                    util.notify('Success change direction').success();
                }
            })
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

        if (!session.isValid()) {
            auth.clearSession();
            return;
        }

        getUserStats();

        // Slides the expiry forward on every visit, so a dashboard in regular
        // use never reaches its own deadline. Deliberately not awaited: the page
        // is already usable on the token in hand.
        session.refresh();
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
                changeFonts,
                changeDirection,
                resetDividerColour,
                uploadCouplePhoto,
                removeCouplePhoto,
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