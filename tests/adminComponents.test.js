import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import AdminCheckIn from '../src/features/admin/AdminCheckIn.jsx';
import { AdminForm, Pagination } from '../src/features/admin/AdminCommon.jsx';
const h = React.createElement;
const token = '70000000-0000-4000-8000-000000000001';
const ticket = { ticket_code:'TNL-TKT-'+'A'.repeat(32),ticket_name:'VIP',concert_name:'Concert',concert_starts_at:'2026-09-08T13:00:00Z',venue:'Venue',status:'valid' };
test('artist picker pagination cannot submit its parent management form', () => {
  let view; act(() => { view=create(h('form',null,h(Pagination,{ page:0,count:40,onChange() {} }))); });
  for (const button of view.root.findAllByType('button')) assert.equal(button.props.type,'button');
  act(() => view.unmount());
});
test('staff preview is read-only, confirmation checks in once, editing clears previous result', async () => {
  const calls=[]; const service = { async rpc(name,args) { calls.push([name,args]); return name === 'check_in_ticket' ? { ...ticket,status:'used',used_at:'2026-09-08T13:01:00Z' } : ticket; } };
  let view; await act(async () => { view=create(h(AdminCheckIn,{ service })); });
  await act(async () => view.root.findByType('input').props.onChange({ target:{ value:'https://example.com/verify-ticket/'+token } }));
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(calls.length,1); assert.equal(calls[0][0],'admin_lookup_ticket');
  assert.match(JSON.stringify(view.toJSON()),/VÉ HỢP LỆ/);
  await act(async () => view.root.findAllByType('button').find(b => b.children.includes('Xác nhận check-in')).props.onClick());
  assert.equal(calls[1][0],'check_in_ticket'); assert.equal(calls[1][1].p_reference,token);
  assert.match(JSON.stringify(view.toJSON()),/CHECK-IN THÀNH CÔNG/);
  assert.equal(view.root.findAllByType('button').some(b => b.children.includes('Xác nhận check-in')),false);
  await act(async () => view.root.findByType('input').props.onChange({ target:{ value:'bad' } }));
  assert.doesNotMatch(JSON.stringify(view.toJSON()),/CHECK-IN THÀNH CÔNG|TNL-TKT/);
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.match(JSON.stringify(view.toJSON()),/KHÔNG TÌM THẤY VÉ/); assert.equal(calls.length,2);
  act(() => view.unmount());
});
test('a ticket consumed after preview produces duplicate warning, never a success', async () => {
  let view; const service = { async rpc(name) { if (name==='check_in_ticket') throw { code:'TA007' }; return ticket; } };
  await act(async () => { view=create(h(AdminCheckIn,{ service })); });
  await act(async () => view.root.findByType('input').props.onChange({ target:{ value:token } }));
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  await act(async () => view.root.findAllByType('button').find(b => b.children.includes('Xác nhận check-in')).props.onClick());
  assert.match(JSON.stringify(view.toJSON()),/Vé đã được sử dụng/);
  assert.doesNotMatch(JSON.stringify(view.toJSON()),/CHECK-IN THÀNH CÔNG/);
  act(() => view.unmount());
});
test('new artist form renders and stops invalid writes with Vietnamese validation', async () => {
  let view; let saved=false;
  await act(async () => { view=create(h(AdminForm,{ table:'artists',row:null,onSaved:() => { saved=true; } })); });
  await act(async () => view.root.findByType('form').props.onSubmit({ preventDefault() {} }));
  assert.equal(saved,false); assert.match(JSON.stringify(view.toJSON()),/Vui lòng điền thông tin này/);
  act(() => view.unmount());
});
