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
  console,
  setTimeout, clearTimeout,
  window: {},
  alert: () => {},
  confirm: () => true,
  supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signInWithPassword: async () => ({ error: null }), signUp: async () => ({ error: null }), signOut: async () => ({ error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), delete: async () => ({ data: null, error: null }) }) }) },
  document: {
    documentElement: { classList: { toggle() {} } },
    addEventListener() {},
    getElementById(id) { return { value: elementValues.get(id) ?? '', checked: false, innerHTML: '', style: {}, focus() {}, setSelectionRange() {} }; },
    querySelector() { return null; }
  },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
  navigator: {},
  location: { search: '', origin: 'http://localhost' },
  URLSearchParams,
  FileReader: function(){}, Image: function(){}, Blob: function(){}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
};
context.window = context;
vm.createContext(context);
scripts.forEach(script => vm.runInContext(script, context));
vm.runInContext('render = function(){}; closeModal = function(){ state.modal = null; }; saveData = function(){};', context);
function set(values) { elementValues.clear(); Object.entries(values).forEach(([k,v]) => elementValues.set(k, String(v))); }
function evalIn(code) { return vm.runInContext(code, context); }

// Clean, deterministic fixture.
evalIn(`state.data.objects = []; state.data.clients = []; state.data.priceItems = [
  { id:'price-a', category:'Плитка', name:'Укладання плитки', unit:'м²', price:50 },
  { id:'price-b', category:'Підготовка', name:'Ґрунтування', unit:'м²', price:5 }
]; state.nav='objects'; state.selectedObjId=null; state.selectedRoomId=null; state.selectedZoneId=null; state.selectedClientId=null; state.objSearch=''; state.openActionMenuId=null; state.quick='Робота';`);

// Create client from object modal and create object with customer.
evalIn(`state.modal = { type:'object', pending:{} };`);
set({ 'm-name':'Обʼєкт Smoke', 'm-addr':'Київ', 'm-startdate':'2026-07-15', 'm-note':'Початкова примітка' });
evalIn(`handleClientSelectChange('__new__')`);
assert(evalIn(`state.modal.type`) === 'client', 'New customer modal did not open from object form');
set({ 'm-name':'Замовник Smoke', 'm-phone':'+380000000000', 'm-addr':'Київ', 'm-note':'VIP' });
evalIn(`submitClient('')`);
assert(evalIn(`state.data.clients.length`) === 1, 'Customer was not created from object modal');
assert(evalIn(`state.modal.type`) === 'object' && evalIn(`state.modal.pending.clientId`) === evalIn(`state.data.clients[0].id`), 'Object modal did not restore selected customer');
set({ 'm-name':'Обʼєкт Smoke', 'm-addr':'Київ', 'm-clientid': evalIn(`state.data.clients[0].id`), 'm-startdate':'2026-07-15', 'm-note':'Початкова примітка' });
evalIn(`submitObject('')`);
assert(evalIn(`state.data.objects.length`) === 1, 'Object create failed');
assert(evalIn(`getObj().clientId`) === evalIn(`state.data.clients[0].id`), 'Object customer link failed');

// Edit, status, archive/restore, search, action menu.
const objId = evalIn(`state.selectedObjId`);
evalIn(`state.modal = { type:'object', id: '${objId}' };`);
set({ 'm-name':'Обʼєкт Smoke Edit', 'm-addr':'Львів', 'm-clientid':'', 'm-startdate':'2026-07-16', 'm-note':'Оновлено' });
evalIn(`submitObject('${objId}')`);
assert(evalIn(`getObj().name`) === 'Обʼєкт Smoke Edit' && evalIn(`getObj().clientId`) === null, 'Object edit failed');
evalIn(`setObjectStatus('${objId}', 'active'); toggleArchiveObject('${objId}');`);
assert(evalIn(`getObj().status`) === 'active' && evalIn(`getObj().archived`) === true, 'Status/archive failed');
evalIn(`toggleArchiveObject('${objId}'); setObjSearch('львів');`);
assert(evalIn(`objMatchesSearch(getObj(), state.objSearch)`) === true, 'Object search failed');
evalIn(`toggleActionMenu('${objId}');`);
assert(evalIn(`state.openActionMenuId`) === objId && evalIn(`objActionMenuHtml(getObj()).includes('Архівувати')`), 'Object action menu failed');

// Zones, rooms, moves, and modal rendering.
evalIn(`state.objSearch=''; state.openActionMenuId=null; state.modal={type:'zone'};`);
set({ 'm-name':'Поверх 1' });
evalIn(`submitZone()`);
const zoneId = evalIn(`getObj().zones[0].id`);
evalIn(`state.selectedZoneId='${zoneId}'; state.modal={type:'room'};`);
set({ 'm-name':'Ванна' });
evalIn(`submitRoom()`);
const roomId = evalIn(`getObj().rooms[0].id`);
assert(evalIn(`getObj().zones[0].roomIds.includes('${roomId}')`), 'Room was not attached to selected zone');
evalIn(`state.modal={type:'room', id:'${roomId}'};`);
set({ 'm-name':'Ванна Edit' });
evalIn(`submitRoom()`);
assert(evalIn(`getObj().rooms[0].name`) === 'Ванна Edit', 'Room edit failed');
evalIn(`moveRoomToZone('${roomId}', '')`);
assert(evalIn(`!getObj().zones[0].roomIds.includes('${roomId}')`), 'Move room to unzoned failed');
evalIn(`moveRoomToZone('${roomId}', '${zoneId}')`);
assert(evalIn(`getObj().zones[0].roomIds.includes('${roomId}')`), 'Move room to zone failed');

// Works, sums, areas, progress, and update/delete guards.
evalIn(`state.selectedRoomId='${roomId}'; state.modal={ type:'work', priceItemId:'price-a' };`);
set({ 'm-qty':'10', 'm-price':'50', 'm-note':'Підлога' });
evalIn(`submitWork()`);
evalIn(`state.modal={ type:'work', priceItemId:'price-b' };`);
set({ 'm-qty':'5', 'm-price':'5', 'm-note':'Стіни' });
evalIn(`submitWork()`);
assert(evalIn(`getRoom().works.length`) === 2, 'Work create failed');
const firstWorkId = evalIn(`getRoom().works[0].id`);
const secondWorkId = evalIn(`getRoom().works[1].id`);
evalIn(`state.modal={ type:'work', id:'${firstWorkId}' };`);
set({ 'm-qty':'12.5', 'm-price':'50', 'm-note':'Підлога оновлена' });
evalIn(`submitWork()`);
assert(evalIn(`getRoom().works[0].qty`) === 12.5, 'Work edit failed');
assert(evalIn(`roomSum(getRoom())`) === 650, 'Room/object sum calculation failed');
assert(evalIn(`getRoom().works.filter(w => w.unit === 'м²').reduce((s,w)=>s+w.qty,0)`) === 17.5, 'Area calculation by m² works failed');
evalIn(`toggleWork('${firstWorkId}')`);
assert(evalIn(`roomProgress(getRoom())`) === 50 && evalIn(`objectProgress(getObj())`) === 50, 'Progress calculation failed');
assert(evalIn(`objectProgress({ rooms:[{ works:[{done:true}] }, { works:Array.from({length:9}, () => ({ done:false })) }] })`) === 10, 'Object progress must be weighted by works, not averaged by rooms');
evalIn(`deleteWork('${secondWorkId}')`);
assert(evalIn(`getRoom().works.length`) === 1 && evalIn(`objectSumDone(getObj())`) === 625 && evalIn(`objectSumLeft(getObj())`) === 0, 'Work delete or done/left sums failed');

// Advances/payment calculations.
evalIn(`state.modal={ type:'advance' };`);
set({ 'm-amount':'100', 'm-date':'2026-07-15', 'm-note':'Аванс' });
evalIn(`submitAdvance()`);
assert(evalIn(`getObj().advances.length`) === 1 && evalIn(`renderCalc(getObj()).includes('БАЛАНС ДО ОПЛАТИ')`), 'Advance/create calc failed');
const advanceId = evalIn(`getObj().advances[0].id`);
evalIn(`deleteAdvance('${advanceId}')`);
assert(evalIn(`getObj().advances.length`) === 0, 'Advance delete failed');

// Acts: selection modal, preview, save, lock linked work, view modal.
evalIn(`openActSelect()`);
assert(evalIn(`state.modal.type`) === 'actSelect' && evalIn(`renderModal().includes('Сформувати акт')`), 'Act select modal failed');
evalIn(`toggleActWorkSelect('${firstWorkId}'); goToActPreview();`);
assert(evalIn(`state.modal.type`) === 'actPreview' && evalIn(`renderModal().includes('РАЗОМ')`), 'Act preview failed');
evalIn(`saveAct()`);
assert(evalIn(`state.modal.type`) === 'actView' && evalIn(`getObj().acts.length`) === 1, 'Act save/view failed');
assert(evalIn(`getRoom().works[0].actId`) === evalIn(`getObj().acts[0].id`), 'Act did not link selected work');
evalIn(`toggleWork('${firstWorkId}')`);
assert(evalIn(`getRoom().works[0].done`) === true, 'Linked act work should be locked from toggling');
assert(evalIn(`renderModal().includes('Акт №1') && renderActsTab(getObj()).includes('Акт №1')`), 'Act view/list render failed');

// Delete room, zone, object.
evalIn(`state.modal={ type:'deleteRoom', id:'${roomId}' };`);
assert(evalIn(`renderModal().includes('Видалити робочу зону')`), 'Delete room modal failed');
evalIn(`deleteRoom('${roomId}')`);
assert(evalIn(`getObj().rooms.length`) === 0 && evalIn(`getObj().zones[0].roomIds.length`) === 0, 'Room delete failed');
evalIn(`deleteZone('${zoneId}')`);
assert(evalIn(`getObj().zones.length`) === 0, 'Zone delete failed');
evalIn(`state.selectedObjId=null; state.modal={ type:'deleteObject', id:'${objId}' };`);
assert(evalIn(`renderModal().includes('Видалити об')`), 'Delete object modal failed');
evalIn(`deleteObject('${objId}')`);
assert(evalIn(`state.data.objects.length`) === 0, 'Object delete failed');

console.log('Objects smoke test passed');
