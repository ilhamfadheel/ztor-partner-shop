// lloud.club's account page ("Your account." with its sections down the side, a picker on phones),
// on the fan's real data: the Ztor account (personal details, language), the shop's saved pickup
// contacts (addresses), the preferred payment method on this site, the orders, and security
// (managed on Ztor). Same sections the shop's account page had before; LLOUD's demo-only sections
// (delivery, membership billing, tickets, auction bids, notification prefs) have nothing behind
// them in Ztor yet.
import config from '/lloud-config.js';
import { member, tierOf } from './member-store.js';
import { mountProfilePage } from './profile-page.js';
import { esc, dialog, notify, action, reveal } from './club-ui.js';
import * as state from './ztor/state.js';
import { api } from './ztor/api.js';
import { contactErrors, savedPayment, savePayment } from './ztor/commerce.js';
import { signInHref, signOut } from './ztor/session.js';

const SECTIONS = [['profile', 'Personal details'], ['addresses', 'Addresses'], ['payments', 'Payment methods'], ['orders', 'Orders & returns'], ['security', 'Security & privacy']];
const button = (label, attrs = '', secondary = true) => `<button type="button" class="club-button${secondary ? ' is-secondary' : ''}" ${attrs}>${label}</button>`;
const empty = text => `<p class="account-empty">${text}</p>`;
/** Ztor's own account settings (the console, on the issuer's origin): email, password, 2FA, sign-ins, deletion. */
const onZtor = (page = 'security') => (config.issuer ? `${new URL(config.issuer).origin}/settings/account/${page}` : '');

export function mountAccountPage(root, { renderOrders }) {
  let cleanupProfile = null, section = '', contacts = null, methods = null;
  const initial = () => new URLSearchParams(location.search).get('section') || location.hash.slice(1) || 'profile';

  function render() {
    cleanupProfile?.(); cleanupProfile = null;
    const who = member();
    if (!who.id) {
      root.innerHTML = `<div class="club-empty"><h1>Your account.</h1><p>Sign in to manage your details and purchases.</p>${action('Join / sign in', signInHref('/account'))}</div>`;
      return;
    }
    section = SECTIONS.some(([id]) => id === initial()) ? initial() : 'profile';
    const label = SECTIONS.find(([id]) => id === section)[1];
    root.innerHTML = `<section class="account-page"><header class="account-heading"><div><a class="profile-back" href="/shop">← Back to shop</a><h1>Your account.</h1></div><p>${esc(who.name)} · ${esc(tierOf().name)}</p></header><div class="account-layout"><aside><label class="club-field account-mobile-nav">Account section<select data-account-select>${SECTIONS.map(([id, title]) => `<option value="${id}" ${id === section ? 'selected' : ''}>${title}</option>`).join('')}</select></label><nav class="account-nav" aria-label="Your account">${SECTIONS.map(([id, title]) => `<a href="/account?section=${id}" ${id === section ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</nav><button class="club-text-link account-signout" data-signout>Sign out</button></aside><div class="account-content"><h2 tabindex="-1" data-account-title>${label}</h2><div data-account-content></div></div></div></section>`;
    const content = root.querySelector('[data-account-content]');
    if (section === 'profile') {
      const me = state.account();
      content.innerHTML = `<div data-account-profile></div><section class="account-contact"><h3>Contact details</h3><p class="club-quiet">Your email and phone belong to your Ztor account; change them on Ztor.</p><div class="account-row"><div><h3>Email address</h3><p>${esc(me?.email || '—')}${me?.pendingEmail ? ` · changing to ${esc(me.pendingEmail)}` : ''}</p></div></div><div class="account-row"><div><h3>Phone number</h3><p>${esc(me?.phone || '—')}</p></div></div>${onZtor() ? `<a class="club-text-link" href="${esc(onZtor())}" target="_blank" rel="noreferrer">Change on Ztor ↗</a>` : ''}</section>`;
      cleanupProfile = mountProfilePage(content.querySelector('[data-account-profile]'), { embedded: true });
    } else if (section === 'addresses') content.innerHTML = addresses();
    else if (section === 'payments') content.innerHTML = payments();
    else if (section === 'orders') content.innerHTML = renderOrders();
    else content.innerHTML = `<div class="account-row"><div><h3>Sign-in, password and two-step verification</h3><p>Your Ztor account signs you in here and on every partner site. Its password, sign-in methods, devices and deletion are managed on Ztor.</p></div>${onZtor() ? `<a class="club-button is-secondary" href="${esc(onZtor())}" target="_blank" rel="noreferrer">Manage on Ztor</a>` : ''}</div><div class="account-row"><div><h3>Connected sites</h3><p>See and remove the sites signed in with your Ztor account.</p></div>${onZtor('connected') ? `<a class="club-button is-secondary" href="${esc(onZtor('connected'))}" target="_blank" rel="noreferrer">View on Ztor</a>` : ''}</div><div class="account-row"><div><h3>Sign out</h3><p>Signs you out of LLOUD on this device only; your Ztor account stays signed in elsewhere.</p></div><button class="club-button is-secondary" data-signout>Sign out</button></div>`;
    // In place, like the side nav's links (club.js go()).
    root.querySelector('[data-account-select]').addEventListener('change', e => window.dispatchEvent(new CustomEvent('club:navigate', { detail: '/account?section=' + e.target.value })));
    if ((section === 'addresses' && !contacts) || (section === 'payments' && !methods)) load();
  }

  async function load() {
    try {
      if (section === 'addresses') contacts = await api.pickupContacts();
      if (section === 'payments') methods = await api.paymentMethods();
    } catch (error) {
      if (section === 'addresses') contacts = { error: error.message };
      if (section === 'payments') methods = { error: error.message };
    }
    render();
  }

  function addresses() {
    if (!contacts) return `<p class="club-quiet" role="status">Loading your addresses…</p>`;
    if (contacts.error) return `${empty('Your addresses could not load.')}${button('Try again', 'data-account-retry')}`;
    return `<p>The people who collect your orders. Pick one at checkout, or add a new one there.</p>${contacts.length ? contacts.map(c => `<article class="account-address"><h3>${esc(c.name)}</h3><p>${esc(c.phone)}</p><div class="club-actions">${button('Edit', `data-account-contact="${esc(c.contactId)}"`)}${button('Remove', `data-account-remove-contact="${esc(c.contactId)}"`)}</div></article>`).join('') : empty('No saved addresses yet.')}${button('Add address', 'data-account-contact="new"', false)}`;
  }

  function payments() {
    if (!methods) return `<p class="club-quiet" role="status">Loading payment methods…</p>`;
    if (methods.error) return `${empty('Payment methods could not load.')}${button('Try again', 'data-account-retry')}`;
    if (!methods.length) return empty('No payment methods are offered right now. They appear at checkout once your bag has something in it.');
    const preferred = savedPayment();
    return `<p>Your preferred way to pay on this site, picked first at checkout. Card details are entered on the payment page, never stored here.</p><form data-account-form="payments"><fieldset class="account-options"><legend class="club-sr-only">Preferred payment method</legend>${methods.map(m => `<label class="account-option"><input type="radio" name="method" value="${esc(m.methodCode)}" ${m.methodCode === preferred ? 'checked' : ''}><span>${esc(m.displayName)}</span></label>`).join('')}</fieldset><button class="club-button" type="submit">Save preference</button></form>`;
  }

  function contactEditor(id) {
    const current = contacts.find(c => c.contactId === id) || {};
    const node = dialog(id === 'new' ? 'Add address' : 'Edit address', `<form data-contact-editor novalidate><label class="club-field">Name<input name="name" value="${esc(current.name || '')}" maxlength="80" required autocomplete="name"></label><label class="club-field">Phone<input name="phone" type="tel" value="${esc(current.phone || '')}" maxlength="40" required autocomplete="tel"></label><p class="profile-error" role="alert" data-account-error></p><button class="club-button" type="submit">Save address</button></form>`);
    node.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const value = Object.fromEntries(new FormData(e.target));
      const errors = contactErrors(value);
      const outlet = node.querySelector('[data-account-error]');
      if (Object.keys(errors).length) { outlet.textContent = Object.values(errors)[0]; return; }
      try {
        if (id === 'new') await api.addPickupContact(value.name.trim(), value.phone.trim());
        else await api.updatePickupContact(id, value.name.trim(), value.phone.trim());
        contacts = await api.pickupContacts();
        node.close(); notify('Address saved.'); render();
      } catch (error) { outlet.textContent = error.message; }
    });
  }

  async function onClick(e) {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return;
    if (t.hasAttribute('data-account-retry')) { contacts = methods = null; return render(); }
    if (t.hasAttribute('data-account-contact')) return contactEditor(t.dataset.accountContact);
    if (t.dataset.accountRemoveContact) {
      const id = t.dataset.accountRemoveContact;
      const node = dialog('Remove address?', `<p>This removes the saved address. Orders already placed keep their pickup details.</p><p class="profile-error" role="alert" data-account-error></p>${button('Remove address', 'data-confirm-remove', false)}`);
      node.querySelector('[data-confirm-remove]').onclick = async () => {
        try { await api.deletePickupContact(id); contacts = await api.pickupContacts(); node.close(); notify('Address removed.'); render(); }
        catch (error) { node.querySelector('[data-account-error]').textContent = error.message; }
      };
    }
    if (t.hasAttribute('data-signout')) {
      const node = dialog('Sign out?', `<p>You’ll be signed out of LLOUD on this device. Your Ztor account, points and rewards stay as they are.</p>${button('Sign out', 'data-confirm-signout', false)}`);
      node.querySelector('[data-confirm-signout]').onclick = () => signOut('/');
    }
  }

  function onSubmit(e) {
    const form = e.target.closest('[data-account-form="payments"]'); if (!form) return;
    e.preventDefault();
    savePayment(String(new FormData(form).get('method') || ''));
    notify('Payment preference saved.');
  }

  const changed = () => { if (section !== 'profile') render(); };
  const navigate = () => { render(); root.querySelector('[data-account-title]')?.focus({ preventScroll: true }); reveal(root.querySelector('.account-content')); };
  root.addEventListener('click', onClick); root.addEventListener('submit', onSubmit); window.addEventListener('hashchange', navigate); document.addEventListener('member:change', changed);
  render();
  return () => { cleanupProfile?.(); root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); window.removeEventListener('hashchange', navigate); document.removeEventListener('member:change', changed); };
}
