/**
 * STRAY – Lake Tour Edition · Google Sheets backend
 * Paste into Extensions → Apps Script of the organiser's private Sheet.
 * Run setup() once, then Deploy → New deployment → Web app
 *   Execute as: Me · Who has access: Anyone
 * Copy the /exec URL into CONFIG.endpoint in index.html.
 *
 * The Sheet stays private. The web app only:
 *   - appends registration and pledge rows (deduplicated by submissionId)
 *   - returns sanitized leaderboard totals (no emails, no raw rows)
 */

const SHEETS = {
  reg:     { name: 'Registrations', head: ['submission_id','timestamp','name','email','phone','club','note','status','organiser_notes'] },
  pledge:  { name: 'Pledges',       head: ['submission_id','timestamp','entry_type','class_id','class_name','contributor_name','amount_chf','email','identity_key','display_name','public_consent','status','received_chf','organiser_notes'] },
  classes: { name: 'Classes',       head: ['class_id','display_name','active'] }
};
const PLEDGE_STATUS = ['pledged','received','partly received','cancelled','duplicate'];
const EXCLUDED = ['cancelled','duplicate'];
const REG_STATUS = ['requested','approved','declined','duplicate'];
// Sends each pledger an email with payment details, from the Google account that deploys this script.
const SEND_PLEDGE_EMAIL = true;

/* ---------- one-time setup ---------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.values(SHEETS).forEach(s => {
    let sh = ss.getSheetByName(s.name);
    if (!sh) sh = ss.insertSheet(s.name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(s.head);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, s.head.length).setFontWeight('bold');
    }
  });
  const p = ss.getSheetByName(SHEETS.pledge.name);
  p.getRange('L2:L').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(PLEDGE_STATUS, true).build());
  p.getRange('M2:M').setNumberFormat('0.00');
  ss.getSheetByName(SHEETS.reg.name).getRange('H2:H')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(REG_STATUS, true).build());
  ss.getSheetByName(SHEETS.classes.name).getRange('C2:C')
    .setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid());
}

/* ---------- writes ---------- */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents || '{}');
    if (d.website) return json({ ok: true });                      // honeypot: pretend success
    const sid = clean(d.submissionId, 64);
    if (!/^[\w-]{8,64}$/.test(sid)) return json({ ok: false, error: 'Invalid submission.' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (d.type === 'registration') return json(addRegistration(d, sid));
      if (d.type === 'pledge')       return json(addPledge(d, sid));
      return json({ ok: false, error: 'Unknown form.' });
    } finally { lock.releaseLock(); }
  } catch (err) {
    return json({ ok: false, error: 'Server error. Try again.' });
  }
}

function addRegistration(d, sid) {
  const sh = sheet(SHEETS.reg.name);
  if (exists(sh, sid)) return { ok: true, duplicate: true };
  const name = clean(d.name, 120), email = clean(d.email, 160).toLowerCase();
  if (!name || !isEmail(email)) return { ok: false, error: 'Name and a valid email are required.' };
  sh.appendRow([sid, new Date(), name, email, clean(d.phone, 40), clean(d.club, 120), clean(d.note, 600), 'requested', '']);
  return { ok: true };
}

function addPledge(d, sid) {
  const sh = sheet(SHEETS.pledge.name);
  const prior = findRow(sh, sid);
  if (prior) return { ok: true, duplicate: true, amount: Number(prior[6]), target: prior[2] === 'class' ? prior[4] : prior[9] };

  const type = d.entryType === 'individual' ? 'individual' : 'class';
  const name = clean(d.contributorName, 120);
  const email = clean(d.email, 160).toLowerCase();
  const amount = Math.round(Number(d.amount) * 100) / 100;
  if (!name || !isEmail(email)) return { ok: false, error: 'Name and a valid email are required.' };
  if (!(amount >= 1) || amount > 1000000) return { ok: false, error: 'Please check the amount.' };

  let classId = '', className = '', display = '', consent = false;
  if (type === 'class') {
    const c = activeClasses().find(c => c.id === clean(d.classId, 64));
    if (!c) return { ok: false, error: 'Please choose a class from the list.' };
    classId = c.id; className = c.name;
  } else {
    display = clean(d.displayName, 60);
    if (!display) return { ok: false, error: 'Please add a display name.' };
    consent = d.publicConsent === true;
  }
  sh.appendRow([sid, new Date(), type, classId, className, name, amount, email,
                type === 'individual' ? identityKey(email) : '', display, consent, 'pledged', 0, '']);
  CacheService.getScriptCache().remove('board');
  if (SEND_PLEDGE_EMAIL) sendPledgeEmail(email, name, amount, type === 'class' ? className : display);
  return { ok: true, amount, target: type === 'class' ? className : display };
}

/* ---------- reads ---------- */
function doGet(e) {
  if ((e.parameter.action || '') !== 'leaderboard') return json({ ok: false, error: 'Unknown action.' });
  const cache = CacheService.getScriptCache();
  const hit = cache.get('board');
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);

  const classes = activeClasses().map(c => ({ id: c.id, name: c.name, pledged: 0, received: 0 }));
  const byClass = Object.fromEntries(classes.map(c => [c.id, c]));
  const people = {};
  const totals = { pledged: 0, received: 0 };

  const rows = sheet(SHEETS.pledge.name).getDataRange().getValues().slice(1);
  rows.forEach(r => {
    const status = String(r[11] || '').toLowerCase();
    if (!r[0] || EXCLUDED.indexOf(status) >= 0) return;
    const amt = Number(r[6]) || 0, rec = Number(r[12]) || 0;
    totals.pledged += amt; totals.received += rec;
    if (r[2] === 'class') {
      const c = byClass[r[3]];
      if (c) { c.pledged += amt; c.received += rec; }
    } else {
      const k = r[8];
      if (!k) return;
      const p = people[k] || (people[k] = { name: 'Anonymous', pledged: 0, received: 0 });
      p.pledged += amt; p.received += rec;
      if (r[10] === true && r[9]) p.name = String(r[9]);   // latest consenting display name wins
    }
  });

  const round = n => Math.round(n * 100) / 100;
  const out = {
    ok: true,
    updated: new Date().toISOString(),
    totals: { pledged: round(totals.pledged), received: round(totals.received) },
    classes: classes.map(c => ({ id: c.id, name: c.name, pledged: round(c.pledged), received: round(c.received) }))
                    .sort((a, b) => b.pledged - a.pledged || a.name.localeCompare(b.name)),
    individuals: Object.values(people).map(p => ({ name: p.name, pledged: round(p.pledged), received: round(p.received) }))
                    .sort((a, b) => b.pledged - a.pledged)
  };
  const s = JSON.stringify(out);
  cache.put('board', s, 30);
  return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON);
}

/* Clears the cache after you edit status / received amounts by hand. */
function onEdit() { CacheService.getScriptCache().remove('board'); }

/* ---------- helpers ---------- */
function activeClasses() {
  return sheet(SHEETS.classes.name).getDataRange().getValues().slice(1)
    .filter(r => r[0] && r[1] && r[2] === true)
    .map(r => ({ id: String(r[0]).trim(), name: String(r[1]).trim() }));
}
function sheet(n) { return SpreadsheetApp.getActive().getSheetByName(n); }
function exists(sh, sid) { return !!findRow(sh, sid); }
function findRow(sh, sid) {
  if (sh.getLastRow() < 2) return null;
  const hit = sh.getRange(2, 1, sh.getLastRow() - 1, 1).createTextFinder(sid).matchEntireCell(true).findNext();
  return hit ? sh.getRange(hit.getRow(), 1, 1, sh.getLastColumn()).getValues()[0] : null;
}
function identityKey(email) {
  const salt = PropertiesService.getScriptProperties().getProperty('SALT') || '';
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + email);
  return raw.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('').slice(0, 24);
}
function clean(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;   // stop formula injection in the Sheet
  return s;
}
function isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function sendPledgeEmail(to, name, amount, target) {
  try {
    const km = (amount / 100).toFixed(2);
    MailApp.sendEmail({
      to: to,
      subject: 'STRAY Lake Tour — your pledge of CHF ' + amount,
      body:
        'Hi ' + name + ',\n\n' +
        'Thank you. Your pledge is recorded: CHF ' + amount + ' = ' + km + ' km for ' + target + '.\n\n' +
        'Please pay on Monday 30 November 2026, after the runners finish.\n' +
        'Pay with TWINT to Fondation Planètes Enfants Malades (QR code on the site, Donate page) and add the comment "Charity Ultra".\n' +
        '100% goes to the foundation.\n\n' +
        'Questions: david.gomezpereda@mba.imd.org\n\nSTRAY'
    });
  } catch (e) { /* the pledge is saved even if the email fails */ }
}
