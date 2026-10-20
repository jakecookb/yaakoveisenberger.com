-- Sample data so /fund/sample-campaign, the portal and the big screen are populated
-- immediately. Safe to run more than once. Remove with:
--   delete from public.fund_donations where campaign_id = '9a1d2c3e-0000-4000-8000-000000000001';
--   delete from public.fund_campaigns where id = '9a1d2c3e-0000-4000-8000-000000000001';

insert into public.fund_organizations (id, name, slug, ein, contact_email, website_url, platform_fee_bps)
values ('9a1d2c3e-0000-4000-8000-0000000000aa', 'Sample Community Fund', 'sample-community-fund',
        '00-0000000', 'office@example.org', 'https://example.org', 500)
on conflict (id) do nothing;

insert into public.fund_campaigns (
  id, org_id, slug, title, tagline, description, theme_color, goal_cents, bonus_goal_cents,
  starts_at, ends_at, status, approved_at, preset_amounts
)
values (
  '9a1d2c3e-0000-4000-8000-000000000001', '9a1d2c3e-0000-4000-8000-0000000000aa', 'sample-campaign',
  'Build the Future Campaign',
  'Every dollar is matched — up to 4x during Power Hour.',
  E'For 36 hours only, every gift to our new community center is matched by generous partners.\n\n'
  'Your donation funds classrooms, a youth wing and scholarships for families who need them most.\n\n'
  'Join a team, share your link, and help us cross the finish line together.',
  '#4f46e5', 50000000, 75000000,
  now() - interval '1 day', now() + interval '2 days', 'active', now(),
  '{3600,10000,18000,36000,50000,100000}'
)
on conflict (id) do nothing;

insert into public.fund_matchers (id, campaign_id, name, display_name, message, ratio, pledge_cents, priority, ends_at)
values
  ('9a1d2c3e-0000-4000-8000-0000000000b1', '9a1d2c3e-0000-4000-8000-000000000001', 'Power Hour Partners',
   'Power Hour Partners', 'Quadruple impact while it lasts!', 3, 4000000, 10, now() + interval '6 hours'),
  ('9a1d2c3e-0000-4000-8000-0000000000b2', '9a1d2c3e-0000-4000-8000-000000000001', 'The Goldberg Family Foundation',
   'The Goldberg Family Foundation', 'Proud to double every gift.', 1, 15000000, 20, null),
  ('9a1d2c3e-0000-4000-8000-0000000000b3', '9a1d2c3e-0000-4000-8000-000000000001', 'Community Match Fund',
   null, null, 1, 5000000, 30, null)
on conflict (id) do nothing;

insert into public.fund_teams (id, campaign_id, name, slug, captain_name, goal_cents, sort_order)
values
  ('9a1d2c3e-0000-4000-8000-0000000000c1', '9a1d2c3e-0000-4000-8000-000000000001', 'Team Jerusalem', 'jerusalem', 'Miriam L.', 5000000, 1),
  ('9a1d2c3e-0000-4000-8000-0000000000c2', '9a1d2c3e-0000-4000-8000-000000000001', 'Team Brooklyn', 'brooklyn', 'David S.', 5000000, 2),
  ('9a1d2c3e-0000-4000-8000-0000000000c3', '9a1d2c3e-0000-4000-8000-000000000001', 'Team Lakewood', 'lakewood', 'Sarah K.', 4000000, 3),
  ('9a1d2c3e-0000-4000-8000-0000000000c4', '9a1d2c3e-0000-4000-8000-000000000001', 'Youth Division', 'youth', 'Eli R.', 2000000, 4)
on conflict (id) do nothing;

insert into public.fund_ambassadors (id, campaign_id, team_id, name, code, goal_cents, message)
values
  ('9a1d2c3e-0000-4000-8000-0000000000d1', '9a1d2c3e-0000-4000-8000-000000000001', '9a1d2c3e-0000-4000-8000-0000000000c1', 'Rachel Cohen', 'rachel', 1000000, 'Help me reach my goal!'),
  ('9a1d2c3e-0000-4000-8000-0000000000d2', '9a1d2c3e-0000-4000-8000-000000000001', '9a1d2c3e-0000-4000-8000-0000000000c2', 'Avi Friedman', 'avi', 1000000, null),
  ('9a1d2c3e-0000-4000-8000-0000000000d3', '9a1d2c3e-0000-4000-8000-000000000001', '9a1d2c3e-0000-4000-8000-0000000000c3', 'Leah Weiss', 'leah', 500000, null),
  ('9a1d2c3e-0000-4000-8000-0000000000d4', '9a1d2c3e-0000-4000-8000-000000000001', null, 'Josh Klein', 'josh', 500000, 'Every dollar counts.')
on conflict (id) do nothing;

do $$
declare
  v_names    text[] := array['Dana & Michael Levy','Anonymous','The Rosen Family','Yosef B.','Shira Katz','Anonymous',
                             'Benjamin Adler','Naomi & Ari','The Klein Family','Anonymous','Tova Stern','Daniel Mizrahi',
                             'Hannah Gold','Anonymous','Moshe & Chana','Ruth Berger','Noah Feld','Anonymous','Esther Lowy',
                             'Jacob Schwartz','Anonymous','Ilana Shapiro','Sam & Becky','Anonymous'];
  v_amounts  int[]  := array[18000,36000,100000,5000,18000,250000,36000,10000,50000,7200,18000,100000,
                             3600,500000,26000,18000,5400,36000,10000,180000,2500,72000,15000,1000000];
  v_messages text[] := array['So proud to support this!','','In honor of our parents','Go Team Brooklyn!','','Keep building!',
                             'Mazel tov on the new wing','','Matched gifts are the best gifts','','For the kids','',
                             'Lets go!','','In memory of Grandpa Joe','','','Amazing cause','','Lets hit the bonus goal!',
                             '','Proud ambassador donor','',''];
  v_teams    uuid[] := array['9a1d2c3e-0000-4000-8000-0000000000c1','9a1d2c3e-0000-4000-8000-0000000000c2',
                             '9a1d2c3e-0000-4000-8000-0000000000c3','9a1d2c3e-0000-4000-8000-0000000000c4'];
  v_ambs     uuid[] := array['9a1d2c3e-0000-4000-8000-0000000000d1','9a1d2c3e-0000-4000-8000-0000000000d2',
                             '9a1d2c3e-0000-4000-8000-0000000000d3','9a1d2c3e-0000-4000-8000-0000000000d4'];
  i int;
begin
  if exists (select 1 from public.fund_donations where campaign_id = '9a1d2c3e-0000-4000-8000-000000000001') then
    return;
  end if;
  for i in 1 .. array_length(v_names, 1) loop
    insert into public.fund_donations (
      campaign_id, team_id, ambassador_id, amount_cents, donor_name, donor_email, is_anonymous, message,
      source, status, created_at, succeeded_at
    ) values (
      '9a1d2c3e-0000-4000-8000-000000000001',
      case when i % 5 = 0 then null else v_teams[1 + (i % 4)] end,
      case when i % 3 = 0 then v_ambs[1 + (i % 4)] else null end,
      v_amounts[i],
      case when v_names[i] = 'Anonymous' then 'Private Donor' else v_names[i] end,
      'donor' || i || '@example.com',
      v_names[i] = 'Anonymous',
      nullif(v_messages[i], ''),
      case when i % 7 = 0 then 'check' when i % 11 = 0 then 'cash' else 'online' end,
      'succeeded',
      now() - ((array_length(v_names, 1) - i) * interval '47 minutes'),
      now() - ((array_length(v_names, 1) - i) * interval '47 minutes')
    );
  end loop;

  insert into public.fund_campaign_daily_metrics (campaign_id, day, page_views, checkout_starts)
  values ('9a1d2c3e-0000-4000-8000-000000000001', (now() at time zone 'utc')::date, 412, 61)
  on conflict do nothing;
end;
$$;
