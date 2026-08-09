/**
 * Every editable text on the invitation, grouped as it appears on the page.
 *
 * `key` must match the data-content marker in index.html. Adding a field here
 * and marking the element is all that is needed - the storage is key/value, so
 * no migration or API change is involved.
 *
 * type: 'text' (single line) | 'area' (multi line) | 'datetime'
 */
export const contentFields = [
    {
        group: 'Couple',
        icon: 'fa-heart',
        fields: [
            { key: 'couple_display', label: 'Couple (shown on the cover)', type: 'text' },
            { key: 'groom_name', label: 'Groom full name', type: 'text' },
            { key: 'groom_role', label: 'Groom description', type: 'text', hint: 'e.g. First Son' },
            { key: 'groom_father', label: 'Groom father', type: 'text' },
            { key: 'groom_mother', label: 'Groom mother', type: 'text' },
            { key: 'bride_name', label: 'Bride full name', type: 'text' },
            { key: 'bride_role', label: 'Bride description', type: 'text', hint: 'e.g. Second Daughter' },
            { key: 'bride_father', label: 'Bride father', type: 'text' },
            { key: 'bride_mother', label: 'Bride mother', type: 'text' },
        ],
    },
    {
        group: 'Date & Venue',
        icon: 'fa-calendar-day',
        fields: [
            {
                key: 'event_datetime',
                label: 'Wedding date & time',
                type: 'datetime',
                hint: 'Drives the countdown, the printed date and the calendar button.',
            },
            {
                key: 'event_date_text',
                label: 'Printed date (optional)',
                type: 'text',
                hint: 'Leave empty to write it out automatically from the date above.',
            },
            { key: 'ceremony_intro', label: 'Ceremony intro line', type: 'area' },
            { key: 'akad_heading', label: 'Ceremony title', type: 'text' },
            { key: 'akad_time', label: 'Ceremony time', type: 'text' },
            { key: 'resepsi_heading', label: 'Reception title', type: 'text' },
            { key: 'resepsi_time', label: 'Reception time', type: 'text' },
            { key: 'venue_address', label: 'Venue address', type: 'area' },
            { key: 'dresscode_intro', label: 'Dress code intro', type: 'area' },
            { key: 'dresscode_text', label: 'Dress code', type: 'text' },
        ],
    },
    {
        group: 'Greetings & Verses',
        icon: 'fa-star-and-crescent',
        fields: [
            { key: 'home_heading', label: 'Cover heading', type: 'text' },
            { key: 'bismillah', label: 'Opening (Arabic)', type: 'text' },
            { key: 'greeting_open', label: 'Opening greeting', type: 'text' },
            { key: 'invite_line', label: 'Invitation line', type: 'area' },
            { key: 'quran_heading', label: 'Verse section heading', type: 'text' },
            { key: 'quran_1_text', label: 'Verse 1', type: 'area' },
            { key: 'quran_1_ref', label: 'Verse 1 reference', type: 'text' },
            { key: 'quran_2_text', label: 'Verse 2', type: 'area' },
            { key: 'quran_2_ref', label: 'Verse 2 reference', type: 'text' },
            { key: 'closing_greeting', label: 'Closing greeting', type: 'text' },
        ],
    },
    {
        group: 'Love Story',
        icon: 'fa-book-open',
        fields: [
            { key: 'story_heading', label: 'Section heading', type: 'text' },
            { key: 'story_1', label: 'Paragraph 1', type: 'area' },
            { key: 'story_2', label: 'Paragraph 2', type: 'area' },
            { key: 'story_3', label: 'Paragraph 3', type: 'area' },
        ],
    },
    {
        group: 'Gift',
        icon: 'fa-gift',
        fields: [
            { key: 'gift_heading', label: 'Section heading', type: 'text' },
            { key: 'gift_1_name', label: 'Bank account holder', type: 'text' },
            { key: 'gift_account', label: 'Account number', type: 'text' },
            { key: 'gift_2_name', label: 'E-wallet name', type: 'text' },
            { key: 'gift_3_name', label: 'Gift recipient', type: 'text' },
            { key: 'gift_phone', label: 'Contact phone', type: 'text' },
        ],
    },
    {
        group: 'Other Headings',
        icon: 'fa-heading',
        fields: [
            { key: 'welcome_heading', label: 'Welcome screen heading', type: 'text' },
            { key: 'moment_heading', label: 'Moment section heading', type: 'text' },
            { key: 'gallery_heading', label: 'Gallery heading', type: 'text' },
            { key: 'wishes_heading', label: 'Wishes heading', type: 'text' },
            { key: 'calendar_title', label: 'Calendar event title', type: 'text', hint: 'Defaults to "The Wedding of <couple>".' },
            { key: 'calendar_details', label: 'Calendar description', type: 'area' },
        ],
    },
];
