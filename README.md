# Waukegan High School · Class of 2027
## Developer handoff · November 23, 2026

Build the student-run senior-year hub for Waukegan High School. A student should be able to open it on a phone, see the next break, find the next game for their team level, and check commencement details without leaving the site. Use the included pages, styles, artwork and copy as the design reference. Integrate them with the existing production application's working data and submission flows.

Demo: https://waukegan-class-of-2027-demo.katkaicrown.chatgpt.site/  
Existing site: https://waukegan.up.railway.app/  
School calendar: https://whs.wps60.org/o/whs/events  
Demo source revision: 274780594e64b537a2e7d3b04c1e874867e98f66

### Run the exact demo

Extract the ZIP. From the folder containing `dist/`, run:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000/. The export uses root-relative URLs. Serve it at the domain root with directory-index support. The static demo needs no package installation, compilation, API keys, or database. To host a separate preview, set the static publish directory to `dist`. For the Railway application, port the components into its existing project and keep its service and database configuration. The archive contains the demo frontend. The original Railway server source, credentials, uploaded media database and admin system must come from that project's owner.

### Visual design and navigation

- Default to dark mode. Use Waukegan Purple #4B0082 as the brand base, Gold #FFD700 for focal accents and calls to action, and a few Kelly Green #008C45 marks. The demo uses near-black purple #12101C behind dark cards, and off-white #FAF8FC with dark ink #271832 in light mode.
- Use wide centered sections, rounded panels, simple gold icons, legible dates and generous vertical spacing. Serif display headings and countdown numerals distinguish events from navigation and body text. Exact gradients, sizing, spacing, responsive rules and type fallbacks are in the CSS.
- The hero and shortcut cards stretch nearly the full viewport width. Keep the entire background school wordmark visible. The class title and school name each have their own space. Use the supplied Seniors ’27 emblem and school logo. Keep the countdown watermark faint.
- Header has school identity, desktop Events / Photos / Resources shortcuts, a hamburger menu, search and an appearance switch. Center the hamburger on narrow screens. Menu destinations in order: Sports, Events, Class News, Senior Checklist, Photos, Resources, Graduation, Spotlights, FAQ, Contact. Omit the old More button and Yearbook destination.
- Place the sun/moon control in the upper right beside Search. Save the choice using `demo-theme` and apply it before first paint. Ensure the card surface, foreground, badges and controls change together.

### Homepage, in display order

1. On first homepage visit show a small translucent dark-purple dialog with white lettering, a gold accent, a slightly dimmed backdrop and a gold **Continue** button. Heading: **Welcome, Class of 2027 and fellow Bulldogs!** Body: **This is your student-run home for senior year at Waukegan. Find upcoming events, check important deadlines, and share your favorite class photos.** On dismissal set `whs-welcome-complete=yes` in local storage. This is per browser.
2. Hero copy: **Waukegan High School · Bulldogs**, **Class of 2027**, **One class. One last lap. Every Bulldog counted.** Include **View upcoming events** and the full-width **WAUKEGAN HIGH SCHOOL** wordmark.
3. Three shortcut tiles: Events, Photos, Resources. Use the simple icons and purple backgrounds from the export.
4. School break countdown. Show the next break name, start date, days, hours, minutes and seconds. Use America/Chicago for school-day boundaries. During the inclusive break interval show “On break” and hide the clock. Then advance to the next break. After the last known break show dates pending.
5. Upcoming School Events. Sort school listings and individual games by date, omit past start dates and show three previews. Each includes a title, date, available details and a link to its on-site listing. Include View all events.
6. From the class. Show a short approved-photo preview, All photos and Submit your photos.
7. Senior Spotlight. Include All spotlights and Nominate a senior. Use the provided empty state until an approved feature is available. The homepage scrolls vertically. Keep Today at WHS off the page and place Class News and Senior Checklist in the menu.

### School Events, breaks and data updates

Events offers School Events and Sports. Group the official calendar chronologically in expandable months. Show titles, dates or inclusive ranges, and any published times, locations or descriptions. Links such as `/events/#whs-57444156` open the matching month and scroll to the event. Retain the official calendar source link.

The export includes 127 WHS calendar entries captured November 20, 2026. For a refresh, follow the events feed advertised by the official school page. At capture it was https://thrillshare-cmsv2.services.thrillshare.com/api/v2/s/542338/events . Follow the returned pagination links through the last page. Use the source ID for updates and anchors. Preserve all-day dates and date ranges, normalize times to Chicago, and check the description for a ceremony or performance time when the listing itself is marked all day. Keep unassigned athletics listings in School Events until their team level is verified.

`school-calendar.js` holds [start date, title, local detail URL, details, end date]. The Events page contains a rendered copy. Regenerate both from the same records. Refresh the home game's separate preview list when schedules change; when integrating live feeds, match duplicate school and athletics listings before selecting three previews. The export does not automatically fetch new records.

Current break records are Thanksgiving, November 25–27, 2026; winter, December 21, 2026–January 1, 2027; and spring, March 22–26, 2027. The last day of classes is May 27, 2027. It is a school event rather than a break interval. Confirm calendar changes with WHS.

### Winter sports

Provide jump links for Boys, Girls and Additional teams. In that order:

| Section | Teams in display order |
|---|---|
| Boys | Basketball, Wrestling, Bowling, Swimming |
| Girls | Basketball, Bowling, Wrestling |
| Additional | Cheerleading, Dance, Rifle |

Use two columns on wider screens and one at widths up to 560px. Keep the shorter boys’ Bowling and Swimming cards last. Each taller card has a sport-specific illustrated header, title and independent Varsity/JV selector in its top-right corner. Varsity is the initial selection. Switching the selector updates only its card. Show the next matchup, date, time and venue, followed by expandable Later games if more fixtures exist. Display the schedule on the site. Use “Schedule pending” for missing schedules and “Venue pending” for missing locations.

The fixture stores are keyed by team within level. Each row holds [ISO date, matchup, local time label, venue, unique anchor ID]. Keep rows in chronological order and retain stable anchor IDs for homepage links. The snapshot includes varsity basketball and wrestling listings and JV basketball listings. Other selectors can legitimately show pending. Verify new data against level-specific athletics sources such as MaxPreps; preserve whether an event is home, away or a tournament when available.

### Graduation

Display **Friday, May 21, 2027 at 5:00 PM Central · Weiss Field** on the Graduation page and its corresponding event page. Rehearsal is **May 19 at 10:00 AM at Brookside Campus**. Use the school calendar as the source. Show a large May 21 and year, the ceremony details, and then the live countdown directly below the date and above the Event page and Official source links.

The timer reads the ceremony's HTML time value, `2027-05-21T17:00:00-05:00`, and recalculates days, hours, minutes and seconds against the current instant. At or after the start, replace it with **Congratulations, Class of 2027!** Dark mode uses a deep-purple commencement card and bright date text. Keep the separate ceremony, tickets, arrival, attire, ordering, access and rehearsal information. Display pending details only where the school has yet to confirm them.

### Other pages and production services

The included HTML supplies exact headings, full copy, form fields, empty states and links for every route (see ROUTES.txt). Keep Class News and its article details, Senior Checklist, photo gallery, Senior Spotlights, Resources, FAQ, Contact, Search, accessibility and privacy. Preserve the photo, announcement, spotlight nomination and directory-join forms. Remove the standalone Yearbook page and links; keep the senior portrait and quote checklist reminders as text.

The demo deliberately disables form controls marked as previews. Some pages use static sample content, and some links lead to the original site. In production, use the existing server implementation for search, submissions, uploads, moderation and publication. Wire gallery and spotlight previews to approved records. Keep corrections/removal requests working. For a fresh backend, provide storage for uploaded files, a submissions queue, an authorized staff review interface, and pending/approved/rejected states. Only approved content should appear publicly. Validate fields and uploads on the server and test the complete submit–review–publish flow with a test record. Confirm privacy/contact copy describes the actual deployed service.

### Where to edit

| Files under dist/ | Responsibility |
|---|---|
| index.html, senior-home.js | Homepage layout, copy, first visit, break clock, event previews |
| demo.css, center-menu.css, demo.js | Site styling, responsive header, shared menus, demo form behavior |
| theme-init.js, theme.css | Initial saved appearance and mode-specific colors |
| events/index.html, events-view.js, events-layout.css, school-calendar.js | Monthly event list, link handling, source records and layout |
| sports/index.html, sports-cards.css, sports-data.js, sports-view.js | Team order, fixture data, independent level selectors and later games |
| graduation/index.html, graduation/countdown.js, graduation/countdown.css | Commencement details and countdown presentation |
| events/graduation-2027/index.html | Companion ceremony event page |
| images/, favicon.svg, _next/static/chunks/ | School graphics, sample gallery artwork, icon, compiled base stylesheet |
| Remaining route folders | Page-specific content, forms and supporting information |

The demo repeats the shared header and footer in the HTML pages. In the production codebase, update the shared layout when available. Retain the compiled base stylesheet if serving the static export.

### Acceptance checks

1. In a fresh browser profile, open the home page, dismiss the welcome and refresh. It stays dismissed. Toggle light mode, navigate between Home, Events, Sports and Graduation, reload, then switch back to dark.
2. At phone and desktop widths, read the entire school wordmark, access the hamburger menu and operate it by keyboard. Check that the hero, event cards and both countdowns fit without horizontal scrolling.
3. Open each of the three upcoming previews. Verify that the destination highlights the intended school listing or shows the intended game. Test a target in a collapsed month.
4. Test the break clock before a break, during its last day and on the next school day. Check Chicago time while the device is set to another time zone.
5. Select Boys Basketball JV, expand Later games, and verify Girls Basketball still shows Varsity. Switch back. Test a team without published fixtures.
6. Read the graduation date, badge, countdown and buttons in both themes. Test the clock a second before commencement, at commencement and afterward.
7. Confirm all nav and footer destinations resolve and no internal link still points to /yearbook. In production, also test search, approved-photo display, submissions, review and contact delivery. Translate demo-host links and absolute URLs to the intended production domain.
