(() => {
  'use strict';
  if (globalThis.JobAutofillPageWatcher) return;

  // The secret salt is document-local and never returned. This prevents the
  // fingerprint from becoming an unsalted dictionary of occupied field values.
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
  const identities = new WeakMap();
  let nextIdentity = 0;
  const identity = element => {
    if (!element) return 0;
    if (!identities.has(element)) identities.set(element, ++nextIdentity);
    return identities.get(element);
  };
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const hash = async text => 'sha256:' + Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), n => n.toString(16).padStart(2, '0')).join('');
  const visible = element => {
    if (!element.getClientRects().length || element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    for (let parent = element; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
    }
    return true;
  };
  const referencedText = (element, attr) => normalize((element.getAttribute(attr) || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' '));
  const group = element => {
    const parent = element.closest('fieldset,[role="group"],section,[data-group]');
    if (!parent) return [0, ''];
    const heading = parent.querySelector('legend,h1,h2,h3,h4,[data-group-label]');
    return [identity(parent), normalize(parent.getAttribute('aria-label') || referencedText(parent, 'aria-labelledby') || heading?.textContent)];
  };
  const label = element => normalize([
    ...Array.from(element.labels || [], node => node.textContent),
    element.getAttribute('aria-label'), referencedText(element, 'aria-labelledby'),
    element.getAttribute('placeholder'), element.getAttribute('title'),
  ].filter(Boolean).join(' '));
  const choices = element => {
    if (element.tagName === 'SELECT') return Array.from(element.options, option => [option.value, normalize(option.textContent), option.disabled, option.hidden]);
    const list = document.getElementById(element.getAttribute('list'));
    const popup = document.getElementById(element.getAttribute('aria-controls'));
    const nodes = list ? list.querySelectorAll('option') : popup?.querySelectorAll('[role="option"]');
    return Array.from(nodes || [], option => [option.getAttribute('value') || option.getAttribute('data-value') || '', normalize(option.textContent), option.getAttribute('aria-disabled') || '']);
  };
  const occupied = element => {
    // Passwords and selected file names are unnecessary to review field state.
    if (element.type === 'password') return 'protected';
    if (element.type === 'file') return element.files?.length || 0;
    if (element.type === 'checkbox' || element.type === 'radio') return element.checked;
    if (element.tagName === 'SELECT') return Array.from(element.selectedOptions, option => option.value);
    if ('value' in element) return element.value;
    return element.isContentEditable ? element.textContent : (element.getAttribute('aria-checked') || element.getAttribute('aria-valuetext') || element.textContent);
  };
  const observedContext = url => {
    // Generic `id`, page title and route steps are never guessed as an identity.
    for (const kind of ['application', 'requisition', 'job']) {
      const attr = `data-${kind}-id`;
      const values = [...new Set(Array.from(document.querySelectorAll(`[${attr}]`), element => normalize(element.getAttribute(attr))).filter(Boolean))];
      if (values.length > 1) return '';
      if (values.length === 1) return `${kind}:${values[0]}`;
      // Explicit provider identifiers only. Invitation identity takes priority
      // over an e-link when both exist; generic `id` remains unconfirmed.
      const queryKeys = kind === 'application' ? ['applicationid', 'invitekey', 'elinkid'] : kind === 'job' ? ['jobid', 'ghjid'] : ['requisitionid'];
      for (const queryKey of queryKeys) {
        const queryValues = [...url.searchParams].filter(([key]) => key.replace(/[-_]/g, '').toLowerCase() === queryKey).map(([, value]) => normalize(value)).filter(Boolean);
        const unique = [...new Set(queryValues)];
        if (unique.length > 1) return '';
        if (unique.length === 1) return `${kind}:${queryKey === 'invitekey' || queryKey === 'elinkid' ? queryKey + ':' : ''}${unique[0]}`;
      }
      const match = url.pathname.match(new RegExp(`/(?:${kind}|${kind}s)/([^/]+)(?:/|$)`, 'i'));
      // Named routes may be application stages. Only recognizable identifier
      // shapes count; arbitrary slugs stay visibly unconfirmed.
      if (match) {
        const value = decodeURIComponent(match[1]);
        if (/^(?:\d+|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|(?:app|application|job|req|requisition)[-_][a-z0-9_-]+)$/i.test(value)) return `${kind}:${value}`;
      }
    }
    return '';
  };
  // Only identifier metadata is retained inside this isolated document. A
  // synchronous boolean fence closes the hash-await race without exposing IDs.
  let lastContext = '', lastContextKey = '';
  const matchesContext = key => {
    try {
      const current = observedContext(new URL(location.href));
      if (key === '') return current === '';
      return typeof key === 'string' && key === lastContextKey && current === lastContext;
    } catch { return false; }
  };

  const read = async () => {
    // Capture a single synchronous snapshot before awaiting any hashes. Polling
    // this independent reader cannot invalidate the engine's pending scan.
    const url = location.href;
    let context = '';
    try { context = observedContext(new URL(url)); } catch { /* malformed context stays unknown */ }
    const controls = Array.from(document.querySelectorAll('input,select,textarea,[role="combobox"],[role="checkbox"],[role="radio"],[contenteditable="true"]'))
      .filter(element => !['hidden', 'button', 'submit', 'reset', 'image'].includes(element.type) && visible(element));
    const surface = controls.map(element => [
      identity(element), element.tagName, element.type || '', element.getAttribute('role') || '',
      element.id, element.getAttribute('name') || '', element.getAttribute('autocomplete') || '',
      label(element), group(element), identity(element.form), choices(element),
      Boolean(element.disabled || element.closest('fieldset[disabled]')), Boolean(element.readOnly),
      Boolean(element.required), element.getAttribute('aria-disabled') || '',
      element.getAttribute('aria-readonly') || '', occupied(element),
    ]);
    const labelElement = document.querySelector('[data-application-label],[data-job-title]');
    const applicationLabel = normalize(labelElement?.getAttribute('data-application-label') || labelElement?.getAttribute('data-job-title') || document.title).slice(0, 160);
    const [fingerprint, contextKey] = await Promise.all([hash(salt + JSON.stringify(surface)), context ? hash(context) : Promise.resolve('')]);
    lastContext = context; lastContextKey = contextKey;
    return { fingerprint, contextKey, fieldCount: controls.length, url, applicationLabel };
  };
  Object.defineProperty(globalThis, 'JobAutofillPageWatcher', { value: Object.freeze({ read, matchesContext }), configurable: false, writable: false });
})();
