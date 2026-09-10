import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act,create } from 'react-test-renderer';
import { MemoryRouter,Routes,Route,useLocation } from 'react-router-dom';
import { AdminForm } from '../src/features/admin/AdminCommon.jsx';
import { ArtistEditor } from '../src/features/admin/AdminManagement.jsx';
import ArtistImage from '../src/components/ArtistImage.jsx';
import { ConcertContext } from '../src/contexts/ConcertContext.js';
import { adminService,createAdminService } from '../src/features/admin/adminService.js';
import { createArtistImageService } from '../src/features/admin/artistImageService.js';
import { validateAdmin,formValues } from '../src/features/admin/adminModel.js';
import { phase7Db,as,admin } from './helpers/phase75Db.js';
const h=React.createElement;
const oldUrl='https://example.com/old.png';
const newUrl='https://example.supabase.co/storage/v1/object/public/artist-images/artists/new.png';
const artist={ id:'75000000-0000-4000-8000-000000000030',name:'Da Lab',slug:'da-lab',image_url:oldUrl,is_published:true };
const imageFile=() => new globalThis.File(['test png'],'photo.png',{ type:'image/png' });
const button=(view,text) => view.root.findAllByType('button').find(b => b.children.includes(text));
const submit=view => view.root.findByType('form').props.onSubmit({ preventDefault() {} });
async function choose(view) { await act(async () => view.root.findByProps({ type:'file' }).props.onChange({ target:{ files:[imageFile()] } })); }

test('Storage URL comes from returned path; temporary or missing URLs fail safely',async () => {
  const returnedPath='artists/75000000-0000-4000-8000-000000000031.png'; let requestedPath;
  const service=createArtistImageService({ storage:{ from:() => ({
    upload:async () => ({ data:{ path:returnedPath },error:null }),
    getPublicUrl:path => { requestedPath=path; return { data:{ publicUrl:newUrl } }; },
  }) } });
  assert.deepEqual(await service.upload(imageFile()),{ path:returnedPath,url:newUrl }); assert.equal(requestedPath,returnedPath);
  for(const url of ['blob:temporary','data:image/png;base64,abcd','']) {
    const invalid=createArtistImageService({ storage:{ from:() => ({ upload:async () => ({ data:{ path:returnedPath } }),getPublicUrl:() => ({ data:{ publicUrl:url } }) }) } });
    await assert.rejects(invalid.upload(imageFile()),/Chưa thể tải ảnh lên/);
  }
  assert.ok(validateAdmin('artists',{ ...formValues('artists',artist),image_url:'blob:temporary' }).errors.image_url);
});

test('select → upload → save persists permanent URL for new and existing artists without manual URL entry',async () => {
  const db=await phase7Db(); let view;
  try {
    await db.query('insert into public.artists(id,name,slug,image_url,is_published) values ($1,$2,$3,$4,true)',[artist.id,artist.name,artist.slug,oldUrl]);
    for(const existing of [artist,null]) {
      await as(db,admin); const payloads=[]; let resolveUpload; let saved=0;
      // Exercise the actual admin service and real PostgreSQL row, using a local PostgREST-shaped adapter.
      const service=createAdminService({ from(table) {
        assert.equal(table,'artists'); let data; let id; let insert=false;
        const q={ update(value) { data=value; return q; },insert(value) { data=value; insert=true; return q; },eq(key,value) { assert.equal(key,'id'); id=value; return q; },select() { return q; },async single() {
          payloads.push(data); const keys=Object.keys(data);
          assert.ok(keys.every(key => ['id','name','slug','genre','biography','image_url','image_alt','social_links','is_published'].includes(key)));
          const values=keys.map(key => data[key]);
          const sql=insert ? `insert into public.artists(${keys.join(',')}) values (${keys.map((_,i) => '$'+(i+1)).join(',')}) returning *`
            : `update public.artists set ${keys.map((key,i) => key+'=$'+(i+1)).join(',')} where id=$${keys.length+1} returning *`;
          if(!insert) values.push(id);
          return { data:(await db.query(sql,values)).rows[0],error:null };
        } }; return q;
      } });
      await act(async () => { view=create(h(AdminForm,{ table:'artists',row:existing,service,imageService:{ upload:() => new Promise(resolve => { resolveUpload=resolve; }) },onSaved:() => { saved++; } })); });
      if(!existing) for(const [id,value] of [['admin-name','New Artist'],['admin-slug','new-artist']]) await act(async () => view.root.findByProps({ id }).props.onChange({ target:{ value } }));
      if(!existing) await act(async () => view.root.findByProps({ id:'admin-is_published' }).props.onChange({ target:{ checked:true } }));
      assert.equal(view.root.findAllByType('input').some(i => i.props.type==='url' || i.props.id==='admin-image_url'),false);
      assert.match(JSON.stringify(view.toJSON()),/Đường dẫn nghệ sĩ/);
      await choose(view); assert.ok(view.root.findAllByType('img').some(i => i.props.src.startsWith('blob:'))); assert.equal(payloads.length,0);
      let upload; act(() => { upload=button(view,'Tải ảnh lên').props.onClick(); });
      assert.equal(button(view,'Lưu thay đổi').props.disabled,true);
      await act(async () => { await submit(view); }); assert.equal(payloads.length,0,'saving during upload is blocked');
      await act(async () => { resolveUpload({ url:newUrl }); await upload; });
      assert.equal(button(view,'Lưu thay đổi').props.disabled,false);
      assert.ok(view.root.findAllByType('img').some(i => i.props.src===newUrl));
      assert.match(JSON.stringify(view.toJSON()),/Ảnh đã được tải lên. Nhấn Lưu thay đổi/);
      await act(async () => submit(view)); assert.equal(saved,1); assert.equal(payloads.length,1); assert.equal(payloads[0].image_url,newUrl);
      assert.doesNotMatch(JSON.stringify(payloads[0]),/blob:|photo\.png|preview|isUploading/);
      await as(db,null,'anon');
      const persisted=(await db.query('select * from public.artists where slug=$1',[existing ? artist.slug : 'new-artist'])).rows[0];
      assert.equal(persisted.image_url,newUrl,'published row contains the uploaded permanent URL');
      act(() => view.unmount());
      await act(async () => { view=create(h(ArtistImage,{ artist:persisted })); });
      assert.equal(view.root.findByType('img').props.src,newUrl,'public image component uses persisted URL');
      act(() => view.unmount()); view=null;
    }
  } finally { if(view) act(() => view.unmount()); await db.close(); }
});

test('text-only edit, unuploaded selection and failed upload preserve existing image',async () => {
  let view; const payloads=[];
  await act(async () => { view=create(h(AdminForm,{ table:'artists',row:artist,service:{ async save(table,data) { payloads.push(data); } },imageService:{ async upload() { throw new Error('private'); } },onSaved() {} })); });
  await act(async () => view.root.findByProps({ id:'admin-name' }).props.onChange({ target:{ value:'Edited name' } }));
  await act(async () => submit(view)); assert.equal(payloads[0].image_url,oldUrl);
  await choose(view); await act(async () => submit(view)); assert.equal(payloads[1].image_url,oldUrl);
  await act(async () => button(view,'Tải ảnh lên').props.onClick());
  assert.match(JSON.stringify(view.toJSON()),/Chưa thể tải ảnh lên/); assert.equal(button(view,'Lưu thay đổi').props.disabled,false);
  await act(async () => submit(view)); assert.equal(payloads[2].image_url,oldUrl);
  act(() => view.unmount());
});

test('failed artist save retains uploaded URL for retry and never announces success',async () => {
  let view; let saved=0; const payloads=[];
  await act(async () => { view=create(h(AdminForm,{ table:'artists',row:artist,service:{ async save(table,data) { payloads.push(data); if(payloads.length===1) throw new Error('raw database error'); } },imageService:{ async upload() { return { url:newUrl }; } },onSaved:() => { saved++; } })); });
  await choose(view); await act(async () => button(view,'Tải ảnh lên').props.onClick());
  await act(async () => submit(view)); assert.equal(saved,0);
  assert.match(JSON.stringify(view.toJSON()),/Chưa thể lưu thông tin nghệ sĩ. Vui lòng thử lại./); assert.doesNotMatch(JSON.stringify(view.toJSON()),/raw database error/);
  assert.equal(button(view,'Lưu thay đổi').props.disabled,false);
  await act(async () => submit(view)); assert.equal(saved,1); assert.equal(payloads[1].image_url,newUrl);
  act(() => view.unmount());
});

test('successful artist save invalidates public concert data and shows saved feedback',async t => {
  let refreshes=0; let view;
  t.mock.method(adminService,'get',async () => artist);
  t.mock.method(adminService,'save',async () => artist);
  function Destination() { return h('p',null,useLocation().state?.feedback); }
  await act(async () => { view=create(h(ConcertContext.Provider,{ value:{ retry:() => { refreshes++; } } },h(MemoryRouter,{ initialEntries:['/admin/artists/'+artist.id+'/edit'],future:{ v7_startTransition:true,v7_relativeSplatPath:true } },h(Routes,null,
    h(Route,{ path:'/admin/artists/:id/edit',element:h(ArtistEditor) }),h(Route,{ path:'/admin/artists',element:h(Destination) })
  )))); });
  await act(async () => submit(view)); assert.equal(refreshes,1); assert.match(JSON.stringify(view.toJSON()),/Đã cập nhật thông tin nghệ sĩ./);
  act(() => view.unmount());
});
