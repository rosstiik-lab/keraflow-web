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
const checkedValues = new Map();
const context = {
  console,
  setTimeout, clearTimeout,
  window: {},
  supabase: { createClient: () => ({ auth: { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signInWithPassword: async () => ({ error: null }), signUp: async () => ({ error: null }), signOut: async () => ({ error: null }) }, from: () => ({ select() { return this; }, eq() { return this; }, order() { return this; }, single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }), insert: async () => ({ data: null, error: null }), update: async () => ({ data: null, error: null }), delete: async () => ({ data: null, error: null }) }) }) },
  document: {
    documentElement: { classList: { toggle() {} } },
    addEventListener() {},
    getElementById(id) { return { value: elementValues.get(id) ?? '', checked: checkedValues.get(id) ?? false, innerHTML: '', style: {} }; },
    querySelector() { return null; }
  },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
  navigator: {},
  location: { search: '', origin: 'http://localhost' },
  URLSearchParams,
  FileReader: function(){}, Image: function(){},
};
context.window = context;
vm.createContext(context);
scripts.forEach(script => vm.runInContext(script, context));
vm.runInContext('render = function(){}; closeModal = function(){ state.modal = null; }; saveData = function(){};', context);
function set(values, checks = {}) { elementValues.clear(); checkedValues.clear(); Object.entries(values).forEach(([k,v]) => elementValues.set(k, String(v))); Object.entries(checks).forEach(([k,v]) => checkedValues.set(k, !!v)); }
function evalIn(code) { return vm.runInContext(code, context); }

evalIn('state.selectedObjId = state.data.objects[0].id; state.data.settings.materialsCurrency = "₴"; state.data.objects[0].materialItems = []; state.data.objects[0].materialReports = []; state.modal = { itemType: "material" };');
set({ 'm-name':'Клей','m-category':'Клей','m-qty':'1,5','m-unit':'міш','m-price':'100.25','m-date':'2026-07-13T10:00','m-currency':'₴' });
evalIn('submitMaterialItem("")');
assert(evalIn('state.data.objects[0].materialItems[0].qty') === 1.5, 'Comma quantity was not parsed');
assert(evalIn('state.data.objects[0].materialItems[0].price') === 100.25, 'Dot price was not parsed');

evalIn('state.modal = { itemType: "material" };');
set({ 'm-name':'Клей Pro','m-category':'Суміші','m-qty':'2.5','m-unit':'міш','m-price':'200,50','m-date':'2026-07-13T11:00','m-currency':'€' });
evalIn('submitMaterialItem(state.data.objects[0].materialItems[0].id)');
assert(evalIn('state.data.objects[0].materialItems[0].name') === 'Клей Pro', 'Material edit failed');
assert(evalIn('state.data.objects[0].materialItems[0].price') === 200.5, 'Comma price was not parsed');
assert(evalIn('materialCategoryOptionsHtml(state.data.objects[0]).includes("Суміші")'), 'Material category option missing');

evalIn('state.modal = { itemType: "receipt" };');
set({ 'm-amount':'300,75','m-date':'2026-07-13T12:00','m-note':'Чек','m-currency':'$' });
evalIn('submitMaterialItem("")');
assert(evalIn('state.data.objects[0].materialItems[1].amount') === 300.75, 'Receipt create failed');
evalIn('state.modal = { itemType: "receipt" };');
set({ 'm-amount':'400.25','m-date':'2026-07-13T12:30','m-note':'Чек ред.','m-currency':'$' });
evalIn('submitMaterialItem(state.data.objects[0].materialItems[1].id)');
assert(evalIn('state.data.objects[0].materialItems[1].note') === 'Чек ред.', 'Receipt edit failed');

evalIn('state.modal = { itemType: "material" };');
set({ 'm-name':'Борг','m-category':'Борг','m-qty':'3','m-unit':'шт','m-price':'10','m-date':'2026-07-13T13:00','m-currency':'₴' }, { 'm-isdebt': true });
evalIn('submitMaterialItem("")');
assert(evalIn('objectDebtTotalsByCurrency(state.data.objects[0])["₴"]') === 30, 'Supplier debt total failed');

evalIn('state.modal = { paymentType: "customer" };');
set({ 'm-amount':'100,25','m-date':'2026-07-13T14:00','m-note':'Оплата клієнта','m-currency':'₴' });
evalIn('submitMaterialPayment("")');
evalIn('state.modal = { paymentType: "debt" };');
set({ 'm-amount':'10','m-date':'2026-07-13T15:00','m-note':'Оплата боргу','m-currency':'₴' });
evalIn('submitMaterialPayment("")');
assert(evalIn('objectDebtTotalsByCurrency(state.data.objects[0])["₴"]') === 20, 'Supplier debt payment failed');
assert(evalIn('renderMaterialsHeaderStats(state.data.objects[0]).includes("ОПЛАЧЕНО ЗАМОВНИКОМ")'), 'Header payment stats missing');
assert(evalIn('renderMaterialsHeaderStats(state.data.objects[0]).includes("20.00 ₴")'), 'Header totals are incorrect');

evalIn('openMaterialsReportPreview()');
assert(evalIn('state.modal.type') === 'materialReportView', 'Customer report preview failed');
evalIn('saveMaterialsReport()');
assert(evalIn('state.data.objects[0].materialReports.length') === 1, 'Customer report save failed');
assert(evalIn('state.data.objects[0].materialItems.filter(it => it.reportId === null && !it.isDebt && it.type !== "payment").length') === 0, 'Reported items remained open');
assert(evalIn('renderMaterialsTab(state.data.objects[0]).includes("Звіт №1")'), 'Report history in feed missing');
evalIn('state.modal = { type: "materialReportsHistory" };');
assert(evalIn('renderModal().includes("Історія звітів") && renderModal().includes("Звіт №1")'), 'Reports history modal failed');
evalIn('state.modal = { type: "materialPaymentsHistory" };');
assert(evalIn('renderModal().includes("Історія оплат") && renderModal().includes("Оплата клієнта") && renderModal().includes("Оплата боргу")'), 'Payments history modal failed');
console.log('Materials smoke test passed');
