import { util } from './util.js';
import { storage } from './storage.js';
import { dto } from '../connection/dto.js';
import { request, HTTP_POST, HTTP_GET, HTTP_STATUS_OK } from '../connection/request.js';

export const session = (() => {

    /**
     * @type {ReturnType<typeof storage>|null}
     */
    let ses = null;

    /**
     * @returns {string|null}
     */
    const getToken = () => ses.get('token');

    /**
     * @param {string} token
     * @returns {void}
     */
    const setToken = (token) => ses.set('token', token);

    /**
     * @param {object} body
     * @returns {Promise<boolean>}
     */
    const login = (body) => {
        return request(HTTP_POST, '/api/session')
            .body(body)
            .send(dto.tokenResponse)
            .then((res) => {
                if (res.code === HTTP_STATUS_OK) {
                    setToken(res.data.token);
                }

                return res.code === HTTP_STATUS_OK;
            });
    };

    /**
     * @returns {void}
     */
    const logout = () => ses.unset('token');

    /**
     * @returns {boolean}
     */
    const isAdmin = () => String(getToken() ?? '.').split('.').length === 3;

    /**
     * @param {string} token
     * @returns {Promise<object>}
     */
    const guest = (token) => {
        return request(HTTP_GET, '/api/v2/config')
            .withCache(1000 * 60 * 30)
            .withForceCache()
            .token(token)
            .send()
            .then((res) => {
                if (res.code !== HTTP_STATUS_OK) {
                    throw new Error('failed to get config.');
                }

                const config = storage('config');
                for (const [k, v] of Object.entries(res.data)) {
                    config.set(k, v);
                }

                setToken(token);
                return res;
            });
    };

    /**
     * @returns {object|null}
     */
    const decode = () => {
        if (!isAdmin()) {
            return null;
        }

        try {
            return JSON.parse(util.base64Decode(getToken().split('.')[1]));
        } catch {
            return null;
        }
    };

    /**
     * @returns {boolean}
     */
    const isValid = () => {
        if (!isAdmin()) {
            return false;
        }

        return (decode()?.exp ?? 0) > (Date.now() / 1000);
    };

    /**
     * Trades a still-valid token for a fresh one, so a dashboard that is being
     * used keeps sliding forward rather than expiring mid-edit.
     *
     * A failure is not worth surfacing: the token in hand is still good until
     * its own expiry, so the only cost is that the window stops sliding.
     *
     * @returns {Promise<boolean>}
     */
    const refresh = () => {
        if (!isValid()) {
            return Promise.resolve(false);
        }

        return request(HTTP_POST, '/api/session/refresh')
            .token(getToken())
            .send(dto.tokenResponse)
            .then((res) => {
                if (res.code === HTTP_STATUS_OK) {
                    setToken(res.data.token);
                }

                return res.code === HTTP_STATUS_OK;
            })
            .catch(() => false);
    };

    /**
     * @returns {void}
     */
    const init = () => {
        ses = storage('session');
    };

    return {
        init,
        guest,
        isValid,
        login,
        logout,
        refresh,
        decode,
        isAdmin,
        setToken,
        getToken,
    };
})();