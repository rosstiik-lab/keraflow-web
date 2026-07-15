#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const htmlPath = path.join(__dirname, '..', 'www', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(!/^(<<<<<<<|=======|>>>>>>>) /m.test(html), 'Git conflict markers found');
const functions = [...html.matchAll(/function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]);
const duplicates = [...new Set(functions.filter((name, idx) => functions.indexOf(name) !== idx))];
assert(duplicates.length === 0, `Duplicate functions found: ${duplicates.join(', ')}`);
scripts.forEach((script, index) => { try { new Function(script); } catch (error) { throw new Error(`JavaScript syntax error in script ${index}: ${error.message}`); } });

const storage = new Map();
const elementValues = new Map();
const context = {
  console, setTimeout, clearTimeout,
  window: {}, alert: () => {}, confirm: () => true,
  supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signInWithPassword: async () => ({ error: null }), signUp: async () => ({ error: null }), signOut: async () => ({ error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), delete: async () => ({ data: null, error: null }) }) }) },
  document: { documentElement: { classList: { toggle() {} } }, addEventListener() {}, getElementById(id) { return { value: elementValues.get(id) ?? '', checked: false, innerHTML: '', style: {}, focus() {}, setSelectionRange() {} }; }, querySelector() { return null; }, querySelectorAll() { return []; } },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
  navigator: {}, location: { search: '', origin: 'http://localhost' }, URLSearchParams,
  FileReader: function(){}, Image: function(){}, Blob: function(){}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
};
context.window = context;
vm.createContext(context);
scripts.forEach(script => vm.runInContext(script, context));
vm.runInContext('render = function(){}; closeModal = function(){ state.modal = null; }; saveData = function(){};', context);
function set(values) { elementValues.clear(); Object.entries(values).forEach(([k,v]) => elementValues.set(k, String(v))); }
function evalIn(code) { return vm.runInContext(code, context); }

evalIn(`state.data.clients=[]; state.data.objects=[]; state.data.priceItems=[{id:'p-a',category:'Роботи',name:'Укладання плитки',unit:'м²',price:100},{id:'p-b',category:'Роботи',name:'Затирка',unit:'м²',price:20}]; state.nav='clients'; state.selectedClientId=null; state.clientSearch=''; state.clientSort='name-asc'; state.clientPriceSearch=''; state.openActionMenuId=null; state.modal=null;`);

// Create, required fields, phone/address/note card rendering.
evalIn(`openModal('client')`);
assert(evalIn(`state.modal.type`) === 'client' && evalIn(`renderModal().includes('Новий замовник') && renderModal().includes('Телефон') && renderModal().includes('Адреса') && renderModal().includes('Примітка')`), 'Create customer modal is incomplete');
set({ 'm-name':'Бета Замовник', 'm-phone':'+380501112233', 'm-addr':'Київ, Хрещатик 1', 'm-note':'VIP примітка' });
evalIn(`submitClient('')`);
assert(evalIn(`state.data.clients.length`) === 1, 'Customer create failed');
const betaId = evalIn(`state.data.clients[0].id`);
evalIn(`selectClient('${betaId}')`);
let detail = evalIn(`renderClientDetail()`);
assert(detail.includes('Бета Замовник') && detail.includes('+380501112233') && detail.includes('Київ, Хрещатик 1') && detail.includes('VIP примітка'), 'Customer card does not show name/phone/address/note');
assert(detail.includes('Редагувати') && detail.includes('Видалити') && detail.includes('Сформувати пропозицію') && detail.includes('Історія пропозицій') && detail.includes('Поділитися прайсом'), 'Customer main buttons are missing');

// Edit modal and update.
evalIn(`openModal('client','${betaId}')`);
assert(evalIn(`renderModal().includes('Редагувати замовника') && renderModal().includes('Зберегти')`), 'Edit customer modal is incomplete');
set({ 'm-name':'Альфа Замовник', 'm-phone':'+380671234567', 'm-addr':'Львів', 'm-note':'Оновлена примітка' });
evalIn(`submitClient('${betaId}')`);
assert(evalIn(`getClient('${betaId}').name`) === 'Альфа Замовник' && evalIn(`getClient('${betaId}').phone`) === '+380671234567' && evalIn(`getClient('${betaId}').address`) === 'Львів' && evalIn(`getClient('${betaId}').note`) === 'Оновлена примітка', 'Customer edit failed');

// Sorting and search across customer fields.
evalIn(`createClient('Ярема Замовник','+380990000000','Одеса','звичайний')`);
evalIn(`setClientSort('name-asc')`);
assert(evalIn(`(renderClients().indexOf('Альфа Замовник') < renderClients().indexOf('Ярема Замовник'))`), 'Customer ascending sort failed');
evalIn(`setClientSort('name-desc')`);
assert(evalIn(`(renderClients().indexOf('Ярема Замовник') < renderClients().indexOf('Альфа Замовник'))`), 'Customer descending sort failed');
evalIn(`setClientSearch('львів')`);
assert(evalIn(`renderClients().includes('Альфа Замовник') && !renderClients().includes('Ярема Замовник')`), 'Customer search by address failed');
evalIn(`setClientSearch('1234567')`);
assert(evalIn(`renderClients().includes('Альфа Замовник')`), 'Customer search by phone failed');
evalIn(`setClientSearch('оновлена')`);
assert(evalIn(`renderClients().includes('Альфа Замовник')`), 'Customer search by note failed');
evalIn(`setClientSearch('')`);

// Link to object, block deletion, unlink and delete successfully.
evalIn(`state.data.objects=[{id:'obj-customer-smoke',name:'Обʼєкт клієнта',address:'Київ',clientId:'${betaId}',status:'active',rooms:[],materialItems:[],advances:[],zones:[],acts:[],notes:[]}]; state.selectedObjId='obj-customer-smoke';`);
evalIn(`deleteClient('${betaId}')`);
assert(evalIn(`state.modal.type`) === 'blockedDelete' && evalIn(`renderModal().includes('Неможливо видалити замовника') && renderModal().includes('Обʼєкт клієнта')`), 'Linked customer delete protection failed');
evalIn(`state.data.objects[0].clientId=null; state.modal=null; deleteClient('${betaId}')`);
assert(evalIn(`getClient('${betaId}')`) === null, 'Customer delete after unlink failed');

// Object modal customer link and all primary customer modals.
evalIn(`state.modal={type:'object', pending:{}};`);
set({ 'm-name':'Обʼєкт із новим замовником', 'm-addr':'Дніпро', 'm-startdate':'2026-07-15', 'm-note':'obj note' });
evalIn(`handleClientSelectChange('__new__')`);
assert(evalIn(`state.modal.type`) === 'client' && evalIn(`state.modal.returnTo`) === 'object', 'New customer transition from object modal failed');
set({ 'm-name':'Гама Замовник', 'm-phone':'+380630000000', 'm-addr':'Дніпро', 'm-note':'з object modal' });
evalIn(`submitClient('')`);
assert(evalIn(`state.modal.type`) === 'object' && !!evalIn(`state.modal.pending.clientId`), 'Customer link back to object modal failed');
const gammaId = evalIn(`state.modal.pending.clientId`);
evalIn(`selectClient('${gammaId}'); openClientPriceOverrideModal('${gammaId}','p-a')`);
assert(evalIn(`renderModal().includes('Ціна для замовника') && renderModal().includes('Повернути основну ціну')`), 'Customer price modal failed');
set({ 'client-price-override-price':'80' });
evalIn(`submitClientPriceOverride()`);
assert(evalIn(`resolveClientPrice('${gammaId}','p-a',100)`) === 80, 'Customer price override failed');
evalIn(`openQuoteBuilder()`);
assert(evalIn(`state.modal.type === 'quoteBuilder' && renderModal().includes('Сформувати пропозицію')`), 'Quote builder modal failed');
evalIn(`openModal('priceShare')`);
assert(evalIn(`renderModal().includes('Прайс-лист')`), 'Price share modal failed');
evalIn(`openModal('quotesHistory')`);
assert(evalIn(`renderModal().includes('Історія пропозицій')`), 'Quotes history modal failed');

console.log('Customers smoke test passed');
