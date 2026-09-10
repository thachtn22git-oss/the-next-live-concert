import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { act,create } from 'react-test-renderer';
import { MemoryRouter,Routes,Route } from 'react-router-dom';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';
import NotFoundPage from '../src/pages/NotFoundPage.jsx';
import OrderExpiration from '../src/features/orders/components/OrderExpiration.jsx';
import { AdminForm } from '../src/features/admin/AdminCommon.jsx';
import ArtistImageUpload from '../src/features/admin/ArtistImageUpload.jsx';
import ArtistDetailPage from '../src/pages/ArtistDetailPage.jsx';
import { ConcertContext } from '../src/contexts/ConcertContext.js';
import { formatDateTime } from '../src/utils/concert.js';
const h=React.createElement;
const wrap=child => h(MemoryRouter,{ future:{ v7_startTransition:true,v7_relativeSplatPath:true } },child);
test('404 has branded Vietnamese navigation and the app has wildcard plus route error fallback',async () => {
  let view; await act(async () => { view=create(wrap(h(Routes,null,h(Route,{ path:'*',element:h(NotFoundPage) })))); });
  const text=JSON.stringify(view.toJSON()); assert.match(text,/404/); assert.match(text,/Không tìm thấy trang/); assert.ok(view.root.findAllByType('a').some(a => a.props.href==='/'));
  const routes=await readFile(new URL('../src/routes.jsx',import.meta.url),'utf8');
  assert.match(routes,/path: '\*', element: <NotFoundPage/); assert.match(routes,/errorElement: <ErrorFallback/);
  act(() => view.unmount());
});
test('global render failures produce safe fallback instead of stack traces',async t => {
  t.mock.method(globalThis.console,'error',() => {});
  function Broken() { throw new Error('private stack and SQL'); }
  let view; await act(async () => { view=create(h(ErrorBoundary,null,h(Broken))); });
  const text=JSON.stringify(view.toJSON()); assert.match(text,/Đã xảy ra lỗi/); assert.doesNotMatch(text,/private stack|SQL/);
  assert.ok(view.root.findAllByType('button').some(b => b.children.includes('TẢI LẠI')));
  act(() => view.unmount());
});
test('unknown artist has an intentional Vietnamese state',async () => {
  let view;
  await act(async () => { view=create(h(ConcertContext.Provider,{ value:{ status:'success',artists:[],schedules:[],concert:null,retry() {} } },wrap(h(ArtistDetailPage)))); });
  assert.match(JSON.stringify(view.toJSON()),/Không tìm thấy nghệ sĩ/); act(() => view.unmount());
});
test('order deadline is informational, terminal expired order has no active countdown',async () => {
  const previous=globalThis.window; globalThis.window={ setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval };
  let view;
  try {
    await act(async () => { view=create(h(OrderExpiration,{ order:{ status:'pending',payment_status:'unpaid',expires_at:'2000-01-01T00:00:00Z' },onRefresh() {} })); });
    assert.match(JSON.stringify(view.toJSON()),/Đã đến hạn giữ chỗ/);
    assert.doesNotMatch(JSON.stringify(view.toJSON()),/Đơn hàng đã hết hạn và bị hủy/);
    await act(async () => view.update(h(OrderExpiration,{ order:{ status:'cancelled',payment_status:'unpaid',expired_at:'2000-01-01T00:00:00Z' } })));
    assert.match(JSON.stringify(view.toJSON()),/Đơn hàng đã hết hạn và bị hủy/);
    assert.equal(view.root.findAllByProps({ role:'timer' }).length,0);
    assert.equal(formatDateTime('2026-09-08T18:00:00Z'),'09/09/2026 · 01:00');
  } finally { act(() => view?.unmount()); globalThis.window=previous; }
});
test('same-tick repeated admin submit executes once and reuses its generated ID after network failure',async () => {
  const calls=[]; let rejectSave; let view;
  const service={ save(table,data) { calls.push({ table,data }); return new Promise((resolve,reject) => { rejectSave=reject; }); } };
  await act(async () => { view=create(h(AdminForm,{ table:'artists',row:null,service,onSaved() {} })); });
  for (const [id,value] of [['admin-name','Artist'],['admin-slug','artist']]) await act(async () => view.root.findByProps({ id }).props.onChange({ target:{ value } }));
  let first,second;
  act(() => { const submit=view.root.findByType('form').props.onSubmit; first=submit({ preventDefault() {} }); second=submit({ preventDefault() {} }); });
  assert.equal(calls.length,1); assert.equal(view.root.findByType('fieldset').props.disabled,true);
  await act(async () => { rejectSave(new Error('network')); await Promise.all([first,second]); });
  let retry;
  act(() => { retry=view.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
  assert.equal(calls.length,2); assert.equal(calls[0].data.id,calls[1].data.id);
  await act(async () => { rejectSave(new Error('network')); await retry; });
  act(() => view.unmount());
});
test('image replacement updates form URL only after successful upload; failures preserve old image',async () => {
  let view; let resolveUpload; let busy=false; const changes=[];
  const file=new globalThis.File(['image bytes'],'file.png',{ type:'image/png' });
  const props={ value:'https://example.com/old.png',name:'Artist',onBusy:v => { busy=v; },onUploaded:url => changes.push(url),service:{ upload:() => new Promise(resolve => { resolveUpload=resolve; }) } };
  await act(async () => { view=create(h(ArtistImageUpload,props)); });
  await act(async () => view.root.findByProps({ type:'file' }).props.onChange({ target:{ files:[file] } }));
  let upload; act(() => { upload=view.root.findAllByType('button')[0].props.onClick(); });
  assert.equal(busy,true); assert.deepEqual(changes,[]); assert.equal(view.root.findByProps({ type:'file' }).props.disabled,true);
  await act(async () => { resolveUpload({ url:'https://example.com/new.png' }); await upload; });
  assert.equal(busy,false); assert.deepEqual(changes,['https://example.com/new.png']);
  await act(async () => view.update(h(ArtistImageUpload,{ ...props,service:{ async upload() { throw new Error('private storage failure'); } } })));
  await act(async () => view.root.findByProps({ type:'file' }).props.onChange({ target:{ files:[file] } }));
  await act(async () => view.root.findAllByType('button')[0].props.onClick());
  assert.deepEqual(changes,['https://example.com/new.png']); assert.match(JSON.stringify(view.toJSON()),/Chưa thể tải ảnh lên/); assert.doesNotMatch(JSON.stringify(view.toJSON()),/private storage/);
  act(() => view.unmount());
});
