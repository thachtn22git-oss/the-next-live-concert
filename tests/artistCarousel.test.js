import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import ArtistCarousel from '../src/features/artists/ArtistCarousel.jsx';

test('all artists wrap with previous images on the left and next images on the right, without captions', () => {
  const artists = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: 'Artist ' + i, slug: 'artist-' + i }));
  const wrap = rows => React.createElement(MemoryRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true } }, React.createElement(ArtistCarousel, { artists: rows }));
  let view;
  act(() => { view = create(wrap(artists)); });
  const selected = () => view.root.findByProps({ className: 'artist-carousel-slide artist-carousel-slide--0' }).findByProps({ role: 'img' }).props['aria-label'].replace('Chưa có ảnh của ', '');
  const next = () => act(() => view.root.findByProps({ 'aria-label': 'Nghệ sĩ tiếp theo' }).props.onClick());
  const previous = () => act(() => view.root.findByProps({ 'aria-label': 'Nghệ sĩ trước' }).props.onClick());
  assert.equal(selected(), 'Artist 0');
  previous(); assert.equal(selected(), 'Artist 5');
  next(); assert.equal(selected(), 'Artist 0');
  for (let i = 1; i < 6; i++) {
    next(); assert.equal(selected(), 'Artist ' + i);
    assert.equal(view.root.findAllByType('a').length, 0);
    assert.equal(view.root.findAllByType('h3').length, 0);
    for (const offset of [-2, -1, 0, 1, 2]) {
      const slide = view.root.findByProps({ className: 'artist-carousel-slide artist-carousel-slide--' + offset });
      assert.equal(slide.findByProps({ role: 'img' }).props['aria-label'], 'Chưa có ảnh của Artist ' + ((i + offset + 6) % 6));
    }
  }
  next(); assert.equal(selected(), 'Artist 0');
  act(() => view.update(wrap([artists[2]])));
  assert.equal(selected(), 'Artist 2');
  assert.ok(view.root.findAllByType('button').every(button => button.props.disabled));
  act(() => view.update(wrap([])));
  assert.equal(view.toJSON(), null);
  act(() => view.unmount());
});
