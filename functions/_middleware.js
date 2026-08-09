/**
 * Fills the invitation's link preview from the stored content.
 *
 * The page builds itself from the API in the browser, but the crawlers behind
 * WhatsApp, Telegram and the like never run that script - they read the HTML as
 * served and stop. So a shared link showed whatever the template shipped with:
 * the wrong couple, and a photo hosted on the original template author's
 * domain. This runs at the edge, before the HTML reaches them, and writes the
 * real values into the head.
 *
 * It rewrites for everyone rather than sniffing for crawler user agents. Same
 * output for every visitor is both simpler to reason about and safe to cache,
 * and user-agent lists go stale the moment a new messenger appears.
 */

const CONTENT_TTL = 300;

/**
 * The API base and the public guest key are already declared on <body> for the
 * page's own script. Reading them from there keeps one source of truth rather
 * than a second copy in the Pages environment.
 *
 * @param {string} html
 * @param {string} attribute
 * @returns {string|null}
 */
const bodyAttribute = (html, attribute) => {
    const body = html.match(/<body[^>]*>/i);

    return body ? (body[0].match(new RegExp(`${attribute}="([^"]*)"`))?.[1] ?? null) : null;
};

/**
 * @param {string} base
 * @param {string} key
 * @returns {Promise<Record<string, string>>}
 */
const loadContent = async (base, key) => {
    const url = new URL('api/v2/content', base.endsWith('/') ? base : `${base}/`);

    const res = await fetch(url.toString(), {
        headers: {
            'x-access-key': key,
            // The API rejects anything shorter than 64 characters.
            'User-Agent': 'Mozilla/5.0 (compatible; WeddingInvitationLinkPreview/1.0; Cloudflare Pages Functions)',
        },
        cf: { cacheTtl: CONTENT_TTL, cacheEverything: true },
    });

    if (!res.ok) {
        throw new Error(`content responded ${res.status}`);
    }

    const body = await res.json();

    return body && typeof body.data === 'object' && body.data !== null ? body.data : {};
};

/**
 * A key saved blank means "show nothing here", which is a fine instruction for
 * the page but not for a preview - an empty title renders as a bare URL. Blank
 * values are treated as absent so the next fallback applies.
 *
 * @param {Record<string, string>} content
 * @param {string[]} keys
 * @returns {string|null}
 */
const firstFilled = (content, keys) => {
    for (const key of keys) {
        const value = String(content[key] ?? '').trim();

        if (value.length > 0) {
            return value;
        }
    }

    return null;
};

/**
 * @param {Record<string, string>} content
 * @param {URL} url
 * @returns {{title: string, description: string, image: string, url: string}}
 */
const preview = (content, url) => {
    const couple = firstFilled(content, ['couple_display']);
    const heading = firstFilled(content, ['home_heading', 'welcome_heading']);

    // "<heading> - <couple>" keeps the shape the template already used, in
    // whatever language the invitation is written in.
    let title = [heading, couple].filter(Boolean).join(' - ');

    if (title.length === 0) {
        title = 'Wedding Invitation';
    }

    return {
        title,
        description: firstFilled(content, ['invite_line', 'greeting_open']) ?? title,
        image: new URL('/assets/images/bg.webp', url.origin).toString(),
        url: `${url.origin}/`,
    };
};

/**
 * @param {Response} response
 * @param {{title: string, description: string, image: string, url: string}} meta
 * @returns {Response}
 */
const rewrite = (response, meta) => {
    const values = {
        title: meta.title,
        description: meta.description,
        'og:title': meta.title,
        'og:description': meta.description,
        'og:image': meta.image,
        'og:image:secure_url': meta.image,
        'og:image:alt': meta.title,
        'og:url': meta.url,
        'twitter:title': meta.title,
        'twitter:description': meta.description,
        'twitter:image': meta.image,
        'apple-mobile-web-app-title': meta.title,
    };

    return new HTMLRewriter()
        .on('title', {
            element(el) {
                el.setInnerContent(meta.title);
            },
        })
        .on('meta', {
            element(el) {
                const id = el.getAttribute('property') ?? el.getAttribute('name');

                if (id && Object.prototype.hasOwnProperty.call(values, id)) {
                    el.setAttribute('content', values[id]);
                }
            },
        })
        .on('link[rel="canonical"]', {
            element(el) {
                el.setAttribute('href', meta.url);
            },
        })
        .transform(response);
};

export async function onRequest({ request, next }) {
    const response = await next();
    const url = new URL(request.url);

    // Only the invitation itself. The dashboard is behind a login and has
    // nothing worth previewing.
    const isInvitation = url.pathname === '/' || url.pathname === '/index.html';

    if (!isInvitation || !String(response.headers.get('content-type')).includes('text/html')) {
        return response;
    }

    // Buffered because the values needed to call the API are declared on
    // <body>, which a streaming rewrite would only reach after the head it has
    // to change. The page is small enough that this costs little.
    const html = await response.text();
    const base = bodyAttribute(html, 'data-url');
    const key = bodyAttribute(html, 'data-key');

    const source = new Response(html, response);

    if (!base || !key) {
        return source;
    }

    try {
        return rewrite(source, preview(await loadContent(base, key), url));
    } catch {
        // A preview built from the template beats no page at all, so an API
        // that is down or slow leaves the served HTML untouched.
        return source;
    }
}
