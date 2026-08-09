import { auth } from './auth.js';
import { navbar } from './navbar.js';
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
     * @param {number} id
     * @param {HTMLElement} col
     * @returns {void}
     */
    const deleteGalleryPhoto = (id, col) => {
        if (!util.ask('Are you sure?')) {
            return;
        }

        request(HTTP_DELETE, `/api/photo/gallery/${id}`)
            .token(session.getToken())
            .send(dto.statusResponse)
            .then((res) => {
                if (!res.data.status) {
                    return;
                }

                col.remove();
                util.notify('Success delete photo').success();
            });
    };

    /**
     * @param {{id: number, url: string}} item
     * @returns {HTMLDivElement}
     */
    const renderGalleryItem = (item) => {
        const col = document.createElement('div');
        col.className = 'col-4 position-relative';

        const img = document.createElement('img');
        img.src = item.url;
        img.alt = 'gallery';
        img.className = 'rounded-4 border shadow-sm w-100';
        img.style.aspectRatio = '1';
        img.style.objectFit = 'cover';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-sm btn-secondary rounded-circle position-absolute top-0 end-0 m-1 shadow-sm';
        btn.style.width = '1.75rem';
        btn.style.height = '1.75rem';
        btn.style.padding = '0';
        btn.setAttribute('data-offline-disabled', 'false');
        util.safeInnerHTML(btn, '<i class="fa-solid fa-xmark"></i>');
        btn.onclick = () => deleteGalleryPhoto(item.id, col);

        col.appendChild(img);
        col.appendChild(btn);
        return col;
    };

    /**
     * @returns {void}
     */
    const loadGalleryList = () => {
        request(HTTP_GET, '/api/v2/gallery').token(session.getToken()).send().then((res) => {
            const list = document.getElementById('galleryList');
            list.replaceChildren();
            res.data.forEach((item) => list.appendChild(renderGalleryItem(item)));
        });
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

        document.getElementById('photoHomePreview').src = res.data.photo_home_url || './assets/images/placeholder.webp';
        document.getElementById('photoBridePreview').src = res.data.photo_bride_url || './assets/images/placeholder.webp';
        document.getElementById('photoGroomPreview').src = res.data.photo_groom_url || './assets/images/placeholder.webp';
        loadGalleryList();

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
            .finally(() => btn.restore(true));
    };

    /**
     * @param {HTMLButtonElement} button
     * @param {'home'|'bride'|'groom'} type
     * @returns {void}
     */
    const uploadPhoto = (button, type) => {
        const input = document.getElementById(`photo${type.charAt(0).toUpperCase()}${type.slice(1)}Input`);
        if (!input.files || input.files.length === 0) {
            util.notify('Choose a photo first').warning();
            return;
        }

        const form = new FormData();
        form.append('type', type);
        form.append('photo', input.files[0]);

        const btn = util.disableButton(button);
        input.disabled = true;

        request(HTTP_POST, '/api/photo')
            .token(session.getToken())
            .file(form)
            .send()
            .then((res) => {
                document.getElementById(`photo${type.charAt(0).toUpperCase()}${type.slice(1)}Preview`).src = res.data.url;
                input.value = '';
                util.notify('Success upload photo').success();
            })
            .finally(() => {
                input.disabled = false;
                btn.restore(true);
            });
    };

    /**
     * @param {HTMLButtonElement} button
     * @returns {void}
     */
    const uploadGalleryPhoto = (button) => {
        const input = document.getElementById('photoGalleryInput');
        if (!input.files || input.files.length === 0) {
            util.notify('Choose a photo first').warning();
            return;
        }

        const form = new FormData();
        form.append('photo', input.files[0]);

        const btn = util.disableButton(button);
        input.disabled = true;

        request(HTTP_POST, '/api/photo/gallery')
            .token(session.getToken())
            .file(form)
            .send()
            .then((res) => {
                document.getElementById('galleryList').appendChild(renderGalleryItem(res.data));
                input.value = '';
                util.notify('Success add photo').success();
            })
            .finally(() => {
                input.disabled = false;
                btn.restore(true);
            });
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
                uploadPhoto,
                uploadGalleryPhoto,
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