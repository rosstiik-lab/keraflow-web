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
scripts.forEach((script, index) => {
  try { new Function(script); } catch (error) { throw new Error(`JavaScript syntax error in script ${index}: ${error.message}`); }
});

const storage = new Map();
const elementValues = new Map();
const context = {
  console, setTimeout, clearTimeout,
  window: {}, alert: () => {}, confirm: () => true,
  supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signInWithPassword: async () => ({ error: null }), signUp: async () => ({ error: null }), signOut: async () => ({ error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), delete: async () => ({ data: null, error: null }) }) }) },
  document: { documentElement: { classList: { toggle() {} } }, addEventListener() {}, getElementById(id) { return { value: elementValues.get(id) ?? '', checked: false, innerHTML: '', style: {}, focus() {}, setSelectionRange() {} }; }, querySelector() { return null; } },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
  navigator: {}, location: { search: '', origin: 'http://localhost' }, URLSearchParams,
  FileReader: function(){}, Image: function(){}, Blob: function(){}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
};
context.window = context;
vm.createContext(context);
scripts.forEach(script => vm.runInContext(script, context));
vm.runInContext('render = function(){}; saveData = function(){};', context);
function set(values) { elementValues.clear(); Object.entries(values).forEach(([k,v]) => elementValues.set(k, String(v))); }
function evalIn(code) { return vm.runInContext(code, context); }

// Deterministic price-list fixture.
evalIn(`state.data.priceCategories = []; state.data.priceUnits = []; state.data.priceItems = []; state.data.clients = []; state.data.objects = []; state.selectedPriceCategory='all'; state.priceSearch=''; state.openActionMenuId=null; state.nav='price'; state.modal=null;`);

// Categories: create, edit, sorting/search rendering, delete, and delete guard.
evalIn(`state.modal={type:'priceCategory'};`); set({ 'm-name':'Smoke Категорія B' }); evalIn(`submitPriceCategory()`);
evalIn(`state.modal={type:'priceCategory'};`); set({ 'm-name':'Smoke Категорія A' }); evalIn(`submitPriceCategory()`);
assert(evalIn(`state.data.priceCategories.length`) === 2, 'Category create failed');
evalIn(`state.modal={type:'priceCategory', id:'Smoke Категорія B'};`); set({ 'm-name':'Smoke Категорія C' }); evalIn(`submitPriceCategory()`);
assert(evalIn(`state.data.priceCategories.includes('Smoke Категорія C') && !state.data.priceCategories.includes('Smoke Категорія B')`), 'Category edit failed');
evalIn(`deletePriceCategory('Smoke Категорія C')`);
assert(!evalIn(`state.data.priceCategories.includes('Smoke Категорія C')`), 'Unused category delete failed');

// Units: create, edit, delete, and guards for price items and object works.
evalIn(`state.modal={type:'priceUnits'};`); set({ 'm-newunit':'smoke-unit' }); evalIn(`submitPriceUnit()`);
evalIn(`state.modal={type:'priceUnits'};`); set({ 'm-newunit':'smoke-unused' }); evalIn(`submitPriceUnit()`);
evalIn(`state.modal={type:'priceUnit', id:'smoke-unit'};`); set({ 'm-newunit':'smoke-unit-edit' }); evalIn(`submitPriceUnit()`);
assert(evalIn(`state.data.priceUnits.includes('smoke-unit-edit') && !state.data.priceUnits.includes('smoke-unit')`), 'Unit edit failed');
evalIn(`deletePriceUnit('smoke-unused')`);
assert(!evalIn(`state.data.priceUnits.includes('smoke-unused')`), 'Unused unit delete failed');

// Price items: create, edit, search, sort, modal/action markup, delete guard, successful delete.
evalIn(`state.modal={type:'price'};`); set({ 'm-name':'Smoke Робота B', 'm-category':'Smoke Категорія A', 'm-unit':'smoke-unit-edit', 'm-price':'100' }); evalIn(`submitPrice('')`);
evalIn(`state.modal={type:'price'};`); set({ 'm-name':'Smoke Робота A', 'm-category':'Smoke Категорія A', 'm-unit':'smoke-unit-edit', 'm-price':'40' }); evalIn(`submitPrice('')`);
assert(evalIn(`state.data.priceItems.length`) === 2, 'Price item create failed');
const itemB = evalIn(`state.data.priceItems.find(p => p.name === 'Smoke Робота B').id`);
const itemA = evalIn(`state.data.priceItems.find(p => p.name === 'Smoke Робота A').id`);
evalIn(`state.modal={type:'price', id:'${itemB}'};`); set({ 'm-name':'Smoke Робота B Edit', 'm-category':'Smoke Категорія A', 'm-unit':'smoke-unit-edit', 'm-price':'125.5' }); evalIn(`submitPrice('${itemB}')`);
assert(evalIn(`state.data.priceItems.find(p => p.id === '${itemB}').price`) === 125.5, 'Price item edit failed');
evalIn(`setPriceSearch('b edit')`);
assert(evalIn(`priceMatchesSearch(state.data.priceItems.find(p => p.id === '${itemB}'), state.priceSearch)`) === true, 'Price search failed');
assert(evalIn(`renderPrice().indexOf('Smoke Робота A') < renderPrice().indexOf('Smoke Робота B Edit')`), 'Price sorting failed');
assert(evalIn(`(openModal('price','${itemB}'), renderModal()).includes('Редагувати позицію')`), 'Price edit modal failed');
assert(evalIn(`priceActionMenuHtml(state.data.priceItems.find(p => p.id === '${itemB}')).includes('Видалити') && categoryActionMenuHtml('Smoke Категорія A').includes('Перейменувати')`), 'Action menu buttons failed');
evalIn(`deletePriceCategory('Smoke Категорія A')`);
assert(evalIn(`state.modal.type`) === 'blockedDelete', 'Category delete guard failed');
evalIn(`state.modal=null; deletePriceUnit('smoke-unit-edit')`);
assert(evalIn(`state.modal.type`) === 'blockedDelete', 'Unit delete guard by price item failed');
evalIn(`state.modal=null; deletePriceItem('${itemA}')`);
assert(!evalIn(`state.data.priceItems.some(p => p.id === '${itemA}')`), 'Unused price item delete failed');

// Use a price work on an object, apply local price, verify sums, edit/delete work and deletion protection.
evalIn(`state.data.objects=[{ id:'obj-smoke', name:'Обʼєкт Price Smoke', address:'Київ', clientId:null, status:'active', rooms:[{ id:'room-smoke', name:'Кімната', works:[] }], materialItems:[], advances:[], zones:[], acts:[], notes:[] }]; state.selectedObjId='obj-smoke'; state.selectedRoomId='room-smoke';`);
evalIn(`state.modal={ type:'work', priceItemId:'${itemB}' };`); set({ 'm-qty':'3', 'm-price':'90', 'm-note':'локальна ціна' }); evalIn(`submitWork()`);
assert(evalIn(`getRoom().works.length`) === 1, 'Object work create from price failed');
const workId = evalIn(`getRoom().works[0].id`);
assert(evalIn(`getRoom().works[0].price`) === 90 && evalIn(`objectSum(getObj())`) === 270, 'Local price or sum failed');
evalIn(`state.modal={ type:'work', id:'${workId}' };`); set({ 'm-qty':'4', 'm-price':'95', 'm-note':'оновлено' }); evalIn(`submitWork()`);
assert(evalIn(`objectSum(getObj())`) === 380, 'Work edit or sum update failed');
evalIn(`deletePriceItem('${itemB}')`);
assert(evalIn(`state.modal.type`) === 'blockedDelete', 'Price item delete guard by object work failed');
evalIn(`state.modal=null; getRoom().works[0].actId='act-smoke'; deleteWork('${workId}')`);
assert(evalIn(`getRoom().works.length`) === 1, 'Protected used/locked work was deleted');
evalIn(`getRoom().works[0].actId=null; deleteWork('${workId}')`);
assert(evalIn(`getRoom().works.length`) === 0, 'Work delete failed');
evalIn(`deletePriceItem('${itemB}')`);
assert(evalIn(`state.data.priceItems.length`) === 0, 'Price item delete after unlink failed');
evalIn(`deletePriceCategory('Smoke Категорія A'); deletePriceUnit('smoke-unit-edit')`);
assert(evalIn(`state.data.priceCategories.length`) === 0 && evalIn(`state.data.priceUnits.length`) === 0, 'Cleanup delete failed');

console.log('Price smoke test passed');
