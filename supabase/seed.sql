begin;

-- Fictional demonstration data, not an announced artist line-up.
-- Fixed IDs make this seed repeatable without overwriting later editorial changes.
insert into public.concerts
  (id, slug, name, description, venue, starts_at, ends_at, is_published, is_sample)
values (
  '10000000-0000-4000-8000-000000000001', 'the-next-live-concert-2026',
  'The Next Live Concert',
  'Một đêm âm nhạc. Hàng nghìn cảm xúc.',
  'Đà Nẵng - địa điểm sẽ được công bố',
  '2026-11-21 16:00:00+07', '2026-11-21 23:00:00+07', true, true
) on conflict do nothing;

insert into public.artists
  (id, slug, name, genre, biography, image_url, image_alt, social_links, is_published)
values
  ('20000000-0000-4000-8000-000000000001', 'an-nhien', 'An Nhiên', 'Nhạc pop',
   'An Nhiên là nghệ sĩ hư cấu trong chương trình mẫu. Những giai điệu pop nhẹ nhàng cùng ca từ gần gũi mang đến một khoảng lặng giữa đêm nhạc đầy năng lượng.',
   'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1100&q=85',
   'Ảnh sân khấu minh họa cho nghệ sĩ mẫu An Nhiên', '{}', true),
  ('20000000-0000-4000-8000-000000000002', 'song-xanh', 'Sóng Xanh', 'Nhạc rock',
   'Sóng Xanh là ban nhạc hư cấu trong chương trình mẫu. Tiếng guitar mạnh mẽ và nhịp trống dồn dập tạo nên phần trình diễn dành cho những khán giả muốn hát hết mình.',
   'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1100&q=85',
   'Ảnh đêm nhạc minh họa cho ban nhạc mẫu Sóng Xanh', '{}', true),
  ('20000000-0000-4000-8000-000000000003', 'may-lang', 'Mây Lang', 'Nhạc độc lập',
   'Mây Lang là nghệ sĩ hư cấu trong chương trình mẫu. Phần trình diễn kết hợp chất liệu mộc mạc với những câu chuyện nhỏ về tuổi trẻ và thành phố.',
   'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1100&q=85',
   'Ảnh ánh đèn sân khấu minh họa cho nghệ sĩ mẫu Mây Lang', '{}', true),
  ('20000000-0000-4000-8000-000000000004', 'minh-ha', 'Minh Hạ', 'Nhạc R&B',
   'Minh Hạ là nghệ sĩ hư cấu trong chương trình mẫu. Giọng hát ấm áp cùng những bản phối giàu nhịp điệu mang đến sắc màu R&B cho đêm diễn.',
   'https://images.unsplash.com/photo-1524650359799-842906ca1c06?auto=format&fit=crop&w=1100&q=85',
   'Ảnh biểu diễn minh họa cho nghệ sĩ mẫu Minh Hạ', '{}', true),
  ('20000000-0000-4000-8000-000000000005', 'dj-nhip', 'DJ Nhịp', 'Nhạc điện tử',
   'DJ Nhịp là nghệ sĩ hư cấu trong chương trình mẫu. Những bản phối điện tử mở đầu cuộc hẹn âm nhạc, kết nối khán giả bằng các nhịp điệu sôi động.',
   'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1100&q=85',
   'Ảnh bàn DJ minh họa cho nghệ sĩ mẫu DJ Nhịp', '{}', true)
on conflict do nothing;

insert into public.concert_artists (concert_id, artist_id, display_order, billing, is_featured)
values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Nghệ sĩ chính', true),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 2, 'Ban nhạc khách mời', true),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 3, 'Nghệ sĩ khách mời', false),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 4, 'Nghệ sĩ khách mời', false),
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 5, 'DJ mở màn', false)
on conflict do nothing;

insert into public.schedules
  (id, concert_id, artist_id, title, stage, description, starts_at, ends_at, is_published)
values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', null,
   'Mở cửa', 'Cổng vào', 'Đón khán giả và ổn định khu vực tham dự.', '2026-11-21 16:00:00+07', '2026-11-21 17:00:00+07', true),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005',
   'DJ khởi động', 'Sân khấu chính', 'Khởi động đêm nhạc cùng những bản phối sôi động.', '2026-11-21 17:00:00+07', '2026-11-21 18:00:00+07', true),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003',
   'Những giai điệu đầu tiên', 'Sân khấu chính', 'Khoảng trời âm nhạc độc lập cùng Mây Lang.', '2026-11-21 18:00:00+07', '2026-11-21 19:00:00+07', true),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004',
   'Chạm vào cảm xúc', 'Sân khấu chính', 'Hòa mình vào những giai điệu R&B của Minh Hạ.', '2026-11-21 19:00:00+07', '2026-11-21 19:30:00+07', true),
  ('30000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'Đêm diễn chính', 'Sân khấu chính', 'Cùng An Nhiên hát vang những giai điệu tuổi trẻ.', '2026-11-21 19:30:00+07', '2026-11-21 21:00:00+07', true),
  ('30000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
   'Bùng lên cùng Sóng Xanh', 'Sân khấu chính', 'Tiếng guitar và những nhịp trống kết nối đám đông.', '2026-11-21 21:00:00+07', '2026-11-21 22:30:00+07', true),
  ('30000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', null,
   'Màn kết', 'Sân khấu chính', 'Lưu lại khoảnh khắc và khép lại đêm nhạc.', '2026-11-21 22:30:00+07', '2026-11-21 23:00:00+07', true)
on conflict do nothing;

commit;
