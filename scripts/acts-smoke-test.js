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
['openActSelect','toggleActWorkSelect','toggleActRoomSelectAll','toggleActZoneSelectAll','goToActPreview','backToActSelect','saveAct','viewAct','deleteAct','sharePrintReport'].forEach(name => {
  assert(new RegExp(`\\b${name}\\b`).test(html), `Act function ${name} is missing`);
});
scripts.forEach((script, index) => {
  try { new Function(script); } catch (error) { throw new Error(`JavaScript syntax error in script ${index}: ${error.message}`); }
});

const storage = new Map();
const context = {
  console,
  setTimeout, clearTimeout,
  window: {},
  alert: message => { context.__lastAlert = message; },
  confirm: () => true,
  supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signInWithPassword: async () => ({ error: null }), signUp: async () => ({ error: null }), signOut: async () => ({ error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), delete: async () => ({ data: null, error: null }) }) }) },
  document: {
    documentElement: { classList: { toggle() {} } },
    body: { appendChild() {}, removeChild() {}, style: {} },
    addEventListener() {},
    createElement() { return { style: {}, click() {}, getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,' }; },
    getElementById() { return { value: '', checked: false, innerHTML: '', style: {}, focus() {}, setSelectionRange() {} }; },
    querySelector(selector) { return selector === '.modal .print-report' ? context.__printEl : null; },
  },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
  navigator: {},
  location: { search: '', origin: 'http://localhost' },
  URLSearchParams,
  FileReader: function(){}, Image: function(){}, Blob: function(){}, File: function(parts, name, opts){ this.parts = parts; this.name = name; this.opts = opts; }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  getComputedStyle: () => ({ backgroundColor: '#fff' }),
};
context.window = context;
vm.createContext(context);
scripts.forEach(script => vm.runInContext(script, context));
vm.runInContext('render = function(){}; saveData = function(){};', context);
function evalIn(code) { return vm.runInContext(code, context); }

// Deterministic object with zones, rooms, currencies, available and already locked work.
evalIn(`state.data.settings.currency = '€'; state.data.objects = [{
  id:'obj-act', name:'Обʼєкт актів', address:'Київ', updatedAt: Date.now(), archived:false,
  zones:[{ id:'zone-a', name:'Поверх 1', roomIds:['room-a','room-b'] }], advances:[{ id:'adv-a', amount:100, currency:'€', date:'2026-07-15', note:'Аванс' }], acts:[],
  rooms:[
    { id:'room-a', name:'Ванна', works:[
      { id:'work-a1', name:'Укладання плитки', unit:'м²', qty:10, price:50, done:false, actId:null },
      { id:'work-a2', name:'Затирка', unit:'м²', qty:10, price:5, done:false, actId:null }
    ]},
    { id:'room-b', name:'Кухня', works:[
      { id:'work-b1', name:'Ґрунтування', unit:'м²', qty:20, price:3, done:false, actId:null }
    ]},
    { id:'room-c', name:'Коридор', works:[
      { id:'work-c1', name:'Демонтаж', unit:'м²', qty:4, price:12.5, done:false, actId:null }
    ]}
  ]
}]; state.selectedObjId='obj-act'; state.selectedRoomId='room-a'; state.quick='Акти'; state.modal=null;`);

// Creation modal, individual selection, room select all, zone select all, sums, currency, buttons.
evalIn('openActSelect()');
let modal = evalIn('renderModal()');
assert(evalIn('state.modal.type') === 'actSelect', 'Act select modal did not open');
assert(modal.includes('Сформувати акт') && modal.includes('Обрати всю зону') && modal.includes('Обрати всі'), 'Act selection buttons are missing');
assert(modal.includes('€'), 'Configured currency is not rendered in act selection');
evalIn("toggleActWorkSelect('work-a1')");
assert(evalIn("state.modal.selected['work-a1']") === true, 'Individual work selection failed');
evalIn("toggleActRoomSelectAll('room-a')");
assert(evalIn("state.modal.selected['work-a1'] && state.modal.selected['work-a2']"), 'Room select all failed');
evalIn("toggleActZoneSelectAll('zone-a')");
assert(evalIn("state.modal.selected['work-a1'] && state.modal.selected['work-a2'] && state.modal.selected['work-b1']"), 'Zone select all failed');
evalIn("toggleActZoneSelectAll('zone-a')");
assert(evalIn("!state.modal.selected['work-a1'] && !state.modal.selected['work-a2'] && !state.modal.selected['work-b1']"), 'Zone deselect all failed');
evalIn("toggleActZoneSelectAll('zone-a')");
modal = evalIn('renderModal()');
assert(modal.includes('610.00') && modal.includes('Далі'), 'Selected sum or next button failed');

// Preview, back, save, history, view, print/share controls.
evalIn('goToActPreview()');
assert(evalIn('state.modal.type') === 'actPreview', 'Preview modal did not open');
modal = evalIn('renderModal()');
assert(modal.includes('Попередній перегляд') && modal.includes('РАЗОМ') && modal.includes('610.00') && modal.includes('Назад') && modal.includes('Зберегти'), 'Act preview content/buttons failed');
evalIn('backToActSelect()');
assert(evalIn('state.modal.type') === 'actSelect' && evalIn("state.modal.selected['work-b1']") === true, 'Back to selection did not preserve selected works');
evalIn('goToActPreview(); saveAct()');
const actId = evalIn('getObj().acts[0].id');
assert(evalIn('state.modal.type') === 'actView' && evalIn('getObj().acts[0].totalSum') === 610, 'Act save or sum failed');
assert(evalIn("getObj().rooms[0].works[0].actId") === actId && evalIn("getObj().rooms[1].works[0].actId") === actId, 'Included works were not locked by actId');
assert(evalIn('renderActsTab(getObj())').includes('Акт №1'), 'Act history/list failed');
modal = evalIn('renderModal()');
assert(modal.includes('Акт №1') && modal.includes('Залишок') && (modal.includes('510,00') || modal.includes('510.00')) && modal.includes('Поділитися') && modal.includes('Видалити'), 'Act view/delete/share modal failed');

// Locked work cannot be toggled, edited, deleted, or reselected in a new act.
evalIn("toggleWork('work-a1')");
assert(evalIn("getObj().rooms[0].works[0].done") === false, 'Locked work toggled unexpectedly');
evalIn("updateWork('work-a1', { qty: 99 })");
assert(evalIn("getObj().rooms[0].works[0].qty") === 10, 'Locked work edited unexpectedly');
evalIn("deleteWork('work-a1')");
assert(evalIn("getObj().rooms[0].works.length") === 2, 'Locked work deleted unexpectedly');
evalIn('openActSelect()');
modal = evalIn('renderModal()');
assert(!modal.includes('Укладання плитки') && modal.includes('Демонтаж'), 'Locked work is available for a new act or unlocked work is hidden');

// Delete act unlocks works and removes it from history.
evalIn(`viewAct('${actId}')`);
evalIn(`deleteAct('${actId}')`);
assert(evalIn('getObj().acts.length') === 0, 'Act was not deleted');
assert(evalIn("getObj().rooms.flatMap(r => r.works).every(w => w.actId === null)") === true, 'Works were not unlocked after act deletion');
assert(evalIn('renderActsTab(getObj()).includes("Ще не сформовано")'), 'Deleted act remained in history');

// Recreate a single-work act and verify print/share handles missing PDF libs gracefully.
evalIn('openActSelect(); toggleActWorkSelect("work-c1"); goToActPreview(); saveAct()');
modal = evalIn('renderModal()');
assert((modal.includes('50,00') || modal.includes('50.00')) && modal.includes('€'), 'Recreated act view sum/currency failed');
context.__printEl = { classList: { contains: () => true }, closest: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ top:0, bottom:100, height:100 }) };
evalIn('sharePrintReport()');
assert(context.__lastAlert && context.__lastAlert.includes('PDF'), 'Share/print did not warn when PDF libraries are unavailable');

// Modal close buttons and empty-state modal.
evalIn('closeModal()');
assert(evalIn('state.modal') === null, 'Close modal failed');
evalIn('openActSelect()');
assert(evalIn('renderModal()').includes('Усі роботи вже включені') || evalIn('renderModal()').includes('Демонтаж') === false, 'All-included empty state failed');

console.log('Acts smoke test passed');
