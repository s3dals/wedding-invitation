/**
 * Serves the wedding as a calendar file, from a real URL.
 *
 * The button used to build the .ics in the browser and hand it over as a
 * data: URI. That works on desktop, but iOS Safari blocks top-level
 * navigation to data: URLs outright, so on an iPhone the button did nothing
 * at all. iOS opens its "Add to Calendar" sheet when it is navigated to an
 * ordinary https response served as text/calendar, which is what this is.
 *
 * The event details live in the API, not in the page, so this reads them the
 * same way the middleware reads the link-preview values: the API base and the
 * public guest key are declared on <body>, and the invitation HTML is fetched
 * from the static assets to get at them.
 */

const CONTENT_TTL = 300;

/**
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
            'User-Agent': 'Mozilla/5.0 (compatible; WeddingInvitationCalendar/1.0; Cloudflare Pages Functions)',
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
 * A key saved blank means "show nothing here", so it is treated as absent.
 *
 * @param {Record<string, string>} content
 * @param {string} key
 * @returns {string|null}
 */
const value = (content, key) => {
    const text = String(content[key] ?? '').trim();
    return text.length > 0 ? text : null;
};

/**
 * The stored value is "YYYY-MM-DD HH:MM" in the couple's own local time. It is
 * kept as plain numbers rather than parsed into a Date: a Date would be read
 * back in whatever zone this worker runs in (UTC), which would shift the
 * wedding by however far the couple sits from Greenwich.
 *
 * @param {string|null} raw
 * @returns {{year: number, month: number, day: number, hour: number, minute: number}|null}
 */
const eventParts = (raw) => {
    if (!raw) {
        return null;
    }

    const [datePart, timePart = '00:00'] = raw.trim().split(/[ T]/);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    if (!year || !month || !day) {
        return null;
    }

    return { year, month, day, hour: hour || 0, minute: minute || 0 };
};

/**
 * Date.UTC only to borrow its calendar arithmetic - reading the result back in
 * UTC returns exactly the wall-clock numbers that went in, one hour later.
 *
 * @param {{year: number, month: number, day: number, hour: number, minute: number}} parts
 * @returns {{year: number, month: number, day: number, hour: number, minute: number}}
 */
const plusOneHour = (parts) => {
    const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) + (60 * 60 * 1000));

    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
    };
};

/**
 * No trailing Z and no TZID: a "floating" time, which every calendar shows as
 * the same wall clock wherever the guest happens to be. That is what a wedding
 * invitation means - the ceremony starts at eight in the evening at the venue,
 * not at eight translated into the reader's own zone.
 *
 * @param {{year: number, month: number, day: number, hour: number, minute: number}} parts
 * @returns {string}
 */
const stamp = (parts) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${parts.year}${pad(parts.month)}${pad(parts.day)}T${pad(parts.hour)}${pad(parts.minute)}00`;
};

/**
 * RFC 5545 TEXT escaping. The invitation line and venue address are free-form,
 * and an unescaped comma or semicolon would end the value early.
 *
 * @param {string} text
 * @returns {string}
 */
const escapeText = (text) => text
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');

/**
 * Content lines are limited to 75 octets, continued by starting the next line
 * with a space. Arabic runs three bytes per character, so a description goes
 * past the limit almost immediately - hence splitting on encoded length rather
 * than on character count, and never between the bytes of one character.
 *
 * @param {string} line
 * @returns {string}
 */
const fold = (line) => {
    const encoder = new TextEncoder();

    if (encoder.encode(line).length <= 75) {
        return line;
    }

    const out = [];
    let current = '';
    let octets = 0;
    // The continuation space costs an octet, so wrapped lines carry 74.
    let limit = 75;

    for (const char of line) {
        const size = encoder.encode(char).length;

        if (octets + size > limit) {
            out.push(current);
            current = '';
            octets = 0;
            limit = 74;
        }

        current += char;
        octets += size;
    }

    out.push(current);

    return out.join('\r\n ');
};

/**
 * @param {Record<string, string>} content
 * @param {string} host
 * @returns {string|null}
 */
const icalendar = (content, host) => {
    const parts = eventParts(value(content, 'event_datetime'));

    // Without a stored date there is no event to hand over.
    if (!parts) {
        return null;
    }

    const couple = value(content, 'couple_display');
    const title = value(content, 'calendar_title') ?? (couple ? `The Wedding of ${couple}` : 'Wedding');
    const details = value(content, 'calendar_details') ?? value(content, 'invite_line');
    const location = value(content, 'venue_address');

    // Stable, so importing the same invitation twice updates the entry the
    // guest already has rather than adding a duplicate beside it.
    const uid = `${stamp(parts)}-wedding@${host}`;

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Wedding Invitation//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp(parts)}`,
        `DTSTART:${stamp(parts)}`,
        `DTEND:${stamp(plusOneHour(parts))}`,
        `SUMMARY:${escapeText(title)}`,
        details ? `DESCRIPTION:${escapeText(details)}` : null,
        location ? `LOCATION:${escapeText(location)}` : null,
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean).map(fold).join('\r\n');
};

export async function onRequest({ request, env }) {
    const url = new URL(request.url);

    // env.ASSETS serves the static file directly, which skips the middleware
    // this request would otherwise re-enter on its way back through the site.
    const page = await env.ASSETS.fetch(new URL('/index.html', url.origin));
    const html = await page.text();

    const base = bodyAttribute(html, 'data-url');
    const key = bodyAttribute(html, 'data-key');

    if (!base || !key) {
        return new Response('Calendar unavailable', { status: 404 });
    }

    let ics = null;

    try {
        ics = icalendar(await loadContent(base, key), url.hostname);
    } catch {
        return new Response('Calendar unavailable', { status: 502 });
    }

    if (!ics) {
        return new Response('Calendar unavailable', { status: 404 });
    }

    return new Response(ics, {
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            // "inline" rather than "attachment" on purpose: attachment makes
            // iOS save the file to Files instead of offering to add the event,
            // while the filename still gives desktop browsers something better
            // than the bare route name to save it as.
            'Content-Disposition': 'inline; filename="wedding-invitation.ics"',
            'Cache-Control': `public, max-age=${CONTENT_TTL}`,
        },
    });
}
