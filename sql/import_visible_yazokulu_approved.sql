-- Final approved import from the visible yazokulu.xlsx worksheet only.
-- Source sheet: YAZ OKULU-SINIF PLANLANMASI(TAS
-- Hidden worksheets are intentionally ignored.
-- Imports exactly 4 teachers, 7 sessions/classes, and 84 students from the approved preview.
-- Safe to re-run.

begin;

with teacher_data(employee_code, display_name, bio) as (
  values
  ('YAZ-HUMEYRA', 'HÜMEYRA', 'Imported from visible yazokulu.xlsx worksheet'),
  ('YAZ-KIMIA', 'KIMIA', 'Imported from visible yazokulu.xlsx worksheet'),
  ('YAZ-ONUR', 'ONUR', 'Imported from visible yazokulu.xlsx worksheet'),
  ('YAZ-SEVDE', 'SEVDE', 'Imported from visible yazokulu.xlsx worksheet')
)
insert into public.teachers (
  employee_code,
  display_name,
  bio,
  languages,
  is_active,
  hired_at
)
select
  employee_code,
  display_name,
  bio,
  array['English'],
  true,
  current_date
from teacher_data
on conflict (employee_code) do update
set
  display_name = excluded.display_name,
  bio = excluded.bio,
  languages = excluded.languages,
  is_active = excluded.is_active;

with student_data(student_code, full_name, birth_year, phone) as (
  values
  ('YAZ-VISIBLE-ABDULHAMID-OZTURK-2018-3013', 'ABDULHAMİD ÖZTÜRK', 2018, '5063933013'),
  ('YAZ-VISIBLE-ABDULKADIR-CENGIZ-AVSAR-2019-1950', 'ABDULKADİR CENGİZ AVŞAR', 2019, '5425771950'),
  ('YAZ-VISIBLE-AHMET-EMIN-CELIK-2016-1372', 'AHMET EMİN ÇELİK', 2016, '5301091372'),
  ('YAZ-VISIBLE-AHMET-ENES-SAHIN-2014-5760', 'AHMET ENES ŞAHİN', 2014, '5412595760'),
  ('YAZ-VISIBLE-AHMET-EYDOGAN-2016-8401', 'Ahmet Eydoğan', 2016, '5373538401'),
  ('YAZ-VISIBLE-AHSEN-MINA-KARATURK-2017-6978', 'AHSEN MİNA KARATÜRK', 2017, '5416756978'),
  ('YAZ-VISIBLE-AKIF-EMIR-GUMUS-2015-3450', 'AKİF EMİR GÜMÜŞ', 2015, '5301233450'),
  ('YAZ-VISIBLE-ALI-ASAF-ALMAL-2018-0058', 'Ali Asaf Almalı', 2018, '5050320058'),
  ('YAZ-VISIBLE-ALI-ASAF-TEKGUL-2018-8739', 'ALİ ASAF TEKGÜL', 2018, '5345998739'),
  ('YAZ-VISIBLE-ALIHAN-DUZGUN-2017-7821', 'ALİHAN DÜZGÜN', 2017, '5553127821'),
  ('YAZ-VISIBLE-ALMILA-HIMMET-2017-2431', 'ALMİLA HİMMET', 2017, '5396152431'),
  ('YAZ-VISIBLE-ALP-KEREM-GOKTURK-2019-0266', 'Alp Kerem Göktürk', 2019, '5357930266'),
  ('YAZ-VISIBLE-ASYA-CAGLAYAN-2016-2825', 'Asya Çağlayan', 2016, '5532182825'),
  ('YAZ-VISIBLE-ASYA-OZER-2017-9818', 'ASYA ÖZER', 2017, '5462219818'),
  ('YAZ-VISIBLE-AYHAN-BASAR-2017-0409', 'Ayhan Başar', 2017, '5372590409'),
  ('YAZ-VISIBLE-AYSE-MEYRA-DIZMAN-2018-9232', 'Ayşe Meyra Dizman', 2018, '5464619232'),
  ('YAZ-VISIBLE-AYSE-SENA-OZGUN-2018-9818', 'Ayşe Sena Özgün', 2018, '5457969818'),
  ('YAZ-VISIBLE-AYSE-ZEREN-AVSAR-2017-1950', 'AYŞE ZEREN AVŞAR', 2017, '5425771950'),
  ('YAZ-VISIBLE-AZAD-CIFCI-2019-3612', 'AZAD ÇİFÇİ', 2019, '5550553612'),
  ('YAZ-VISIBLE-AZRA-HATICE-SAHIN-2017-7013', 'Azra Hatice Şahin', 2017, '5384327013'),
  ('YAZ-VISIBLE-BELINAY-YURTTAV-2017-7765', 'Belinay Yurttav', 2017, '5360337765'),
  ('YAZ-VISIBLE-BERILSU-ACKGOZ-2014-2375', 'Berilsu Açıkgöz', 2014, '5435322375'),
  ('YAZ-VISIBLE-BETUL-EFSA-AKGUN-2013-1090', 'Betül Efsa Akgün', 2013, '5432511090'),
  ('YAZ-VISIBLE-BEYAZID-HIMMET-2017-R35', 'Beyazid Himmet', 2017, null),
  ('YAZ-VISIBLE-CEYLIN-MEDINE-DEMIR-2017-6113', 'Ceylin Medine Demir', 2017, '5447366113'),
  ('YAZ-VISIBLE-CNAR-KEMAL-TUNC-2016-2618', 'Çınar Kemal Tunç', 2016, '5433822618'),
  ('YAZ-VISIBLE-DAMLA-KAYA-2018-9502', 'DAMLA KAYA', 2018, '5057829502'),
  ('YAZ-VISIBLE-DERIN-IKRA-UZGENC-2016-0814', 'DERİN İKRA UZGENÇ', 2016, '5348980814'),
  ('YAZ-VISIBLE-DORUK-CAN-YILMAZ-2018-7049', 'DORUK CAN YILMAZ', 2018, '5367077049'),
  ('YAZ-VISIBLE-DURU-TURE-2017-5092', 'DURU TÜRE', 2017, '5415305092'),
  ('YAZ-VISIBLE-EBRAR-SULTAN-POLAT-2018-0025', 'Ebrar Sultan Polat', 2018, '5322590025'),
  ('YAZ-VISIBLE-ECRIN-SARHAN-2018-2788', 'Ecrin Sarıhan', 2018, '5419662788'),
  ('YAZ-VISIBLE-ELIF-POLAT-2017-1882', 'ELİF POLAT', 2017, '5310321882'),
  ('YAZ-VISIBLE-ERTUGRUL-UNGOR-2016-7718', 'Ertuğrul Üngör', 2016, '5393247718'),
  ('YAZ-VISIBLE-ERTURAN-COBANOGLU-2017-6495', 'ERTURAN ÇOBANOĞLU', 2017, '5313136495'),
  ('YAZ-VISIBLE-ESILA-AYDN-2017-3847', 'Esila Aydın', 2017, '5395823847'),
  ('YAZ-VISIBLE-ESLEM-SARE-TEKIN-2018-4181', 'ESLEM SARE TEKİN', 2018, '5439544181'),
  ('YAZ-VISIBLE-EYMEN-SARGNER-2017-3831', 'Eymen Sargıner', 2017, '5443473831'),
  ('YAZ-VISIBLE-EYUP-AYAZ-2017-4082', 'Eyüp Ayaz', 2017, '5522094082'),
  ('YAZ-VISIBLE-EZGI-ALCELIK-2016-0161', 'EZGİ ALÇELİK', 2016, '5330150161'),
  ('YAZ-VISIBLE-FATIMA-DUZGUN-2018-8487', 'FATIMA DÜZGÜN', 2018, '5076698487'),
  ('YAZ-VISIBLE-FIRAT-IDRIS-VARLI-2018-5136', 'FIRAT İDRİS VARLI', 2018, '5363375136'),
  ('YAZ-VISIBLE-HASAN-ALI-ELMAS-2017-9155', 'HASAN ALİ ELMAS', 2017, '5457969155'),
  ('YAZ-VISIBLE-HIFA-ZEHRA-BERBER-2018-8175', 'Hifa Zehra Berber', 2018, '5541558175'),
  ('YAZ-VISIBLE-HIRANUR-CELIK-2016-8513', 'Hiranur Çelik', 2016, '5358268513'),
  ('YAZ-VISIBLE-IKRA-NAZ-ANBAR-2019-R36', 'İkra Naz Anbar', 2019, null),
  ('YAZ-VISIBLE-IPEK-ELA-KORKMAZ-2018-7985', 'İpek Ela Korkmaz', 2018, '5544957985'),
  ('YAZ-VISIBLE-KAREN-KAMAC-2017-2183', 'Karen Kamacı', 2017, '5078722183'),
  ('YAZ-VISIBLE-KEREM-KARABACAK-2017-8691', 'Kerem Karabacak', 2017, '5302258691'),
  ('YAZ-VISIBLE-LIVANUR-SUMER-2018-R18', 'Livanur Sümer', 2018, null),
  ('YAZ-VISIBLE-MELEK-KIYMET-BULUT-2015-5474', 'MELEK KIYMET BULUT', 2015, '5536685474'),
  ('YAZ-VISIBLE-METE-KUVELOGLU-2016-8153', 'Mete Kuveloğlu', 2016, '5349548153'),
  ('YAZ-VISIBLE-MIRAC-CELIK-2016-4021', 'MİRAÇ ÇELİK', 2016, '5419774021'),
  ('YAZ-VISIBLE-MIRAY-HIMMET-2017-R34', 'Miray Himmet', 2017, null),
  ('YAZ-VISIBLE-MIRAY-OZCAN-2016-4798', 'Miray Özcan', 2016, '5458994798'),
  ('YAZ-VISIBLE-MUHAMMED-EYMEN-TEKIN-2018-9711', 'Muhammed Eymen Tekin', 2018, '5350329711'),
  ('YAZ-VISIBLE-MUZAFFER-MERT-TEMIZ-2018-4171', 'Muzaffer Mert Temiz', 2018, '5385924171'),
  ('YAZ-VISIBLE-NAZ-OZDEMIR-2017-4951', 'NAZ ÖZDEMİR', 2017, '5512214951'),
  ('YAZ-VISIBLE-NECMI-BERAT-GEZER-2018-3830', 'NECMİ BERAT GEZER', 2018, '5354783830'),
  ('YAZ-VISIBLE-NIL-OZDEMIR-2018-4951', 'NİL ÖZDEMİR', 2018, '5512214951'),
  ('YAZ-VISIBLE-NURMINA-KANDEMIR-2018-8036', 'NURMİNA KANDEMİR', 2018, '5425858036'),
  ('YAZ-VISIBLE-OMER-ALP-YESILYURT-2018-9240', 'ÖMER ALP YEŞİLYURT', 2018, '5373059240'),
  ('YAZ-VISIBLE-OMER-EROL-SIMSEK-2019-9241', 'Ömer Erol Şimşek', 2019, '5318539241'),
  ('YAZ-VISIBLE-OYKU-ELIF-AYTEKIN-2018-4657', 'ÖYKÜ ELİF AYTEKİN', 2018, '5325764657'),
  ('YAZ-VISIBLE-RALE-NIL-DUMAN-2019-7161', 'RALE NİL DUMAN', 2019, '5065137161'),
  ('YAZ-VISIBLE-REFIK-EFE-KUVELOGLU-2015-3862', 'Refik Efe Kuveloğlu', 2015, '5327343862'),
  ('YAZ-VISIBLE-RUZGAR-ASAF-AY-2018-0004', 'Rüzgar Asaf Ay', 2018, '5374300004'),
  ('YAZ-VISIBLE-SADK-OZDEMIR-2016-8498', 'Sadık Özdemir', 2016, '5514768498'),
  ('YAZ-VISIBLE-SAMET-TAHA-ENGEZ-2018-R17', 'Samet Taha Engez', 2018, null),
  ('YAZ-VISIBLE-SARE-DEMIRHAP-2018-1055', 'SARE DEMİRHAP', 2018, '5415221055'),
  ('YAZ-VISIBLE-SARE-SU-DUMAN-2019-7161', 'SARE SU DUMAN', 2019, '5065137161'),
  ('YAZ-VISIBLE-SU-KALKANDELENLIOGLU-2016-7771', 'SU KALKANDELENLİOĞLU', 2016, '5455617771'),
  ('YAZ-VISIBLE-TANER-TUGRA-ERKARAMAN-2017-4723', 'Taner Tuğra Erkaraman', 2017, '5531604723'),
  ('YAZ-VISIBLE-TUANA-YLDRM-2014-7405', 'Tuana Yıldırım', 2014, '5392537405'),
  ('YAZ-VISIBLE-YAGZ-ADEM-ESER-2018-8864', 'Yağız Adem Eser', 2018, '5313138864'),
  ('YAZ-VISIBLE-YAVUZ-KORKMAZ-2017-8498', 'YAVUZ KORKMAZ', 2017, '5514768498'),
  ('YAZ-VISIBLE-YAVUZ-SELIM-KUCUK-2018-6261', 'Yavuz Selim Küçük', 2018, '5418796261'),
  ('YAZ-VISIBLE-YAVUZ-SELIM-TASLAK-2017-3892', 'YAVUZ SELİM TASLAK', 2017, '5425013892'),
  ('YAZ-VISIBLE-YUSUF-COLAK-2016-6357', 'YUSUF ÇOLAK', 2016, '5389816357'),
  ('YAZ-VISIBLE-YUSUF-EMIR-SONMEZ-2017-7924', 'Yusuf Emir Sönmez', 2017, '5546087924'),
  ('YAZ-VISIBLE-YUSUF-EREN-SAMI-2017-3042', 'Yusuf Eren Sami', 2017, '5392193042'),
  ('YAZ-VISIBLE-YUSUF-ISLAM-KARACA-2017-7173', 'YUSUF İSLAM KARACA', 2017, '5369757173'),
  ('YAZ-VISIBLE-ZEYD-TAHA-ILIDI-2018-5094', 'Zeyd Taha İlidi', 2018, '5365205094'),
  ('YAZ-VISIBLE-ZUMRA-EYDOGAN-2019-8401', 'Zümra Eydoğan', 2019, '5373538401')
)
insert into public.students (
  student_code,
  full_name,
  phone,
  date_of_birth,
  native_language,
  target_language,
  current_level,
  enrollment_date,
  is_active,
  notes
)
select
  student_code,
  full_name,
  phone,
  case when birth_year is null then null else make_date(birth_year, 1, 1) end,
  'Turkish',
  'English',
  'beginner',
  current_date,
  true,
  concat_ws('; ', 'Imported from visible yazokulu.xlsx worksheet', case when birth_year is null then null else 'Birth year: ' || birth_year::text end)
from student_data
on conflict (student_code) do update
set
  full_name = excluded.full_name,
  phone = excluded.phone,
  date_of_birth = excluded.date_of_birth,
  native_language = excluded.native_language,
  target_language = excluded.target_language,
  current_level = excluded.current_level,
  is_active = excluded.is_active,
  notes = excluded.notes;

do $import$
declare
  row_data record;
  teacher_uuid uuid;
  existing_class_id uuid;
  class_name text;
begin
  for row_data in
    select
      c.class_key,
      c.teacher_code,
      c.teacher_name,
      c.room,
      c.starts_at::time as starts_at,
      c.ends_at::time as ends_at,
      t.id as teacher_id
    from (
      values
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-ONUR', 'ONUR', '106', '13:00', '15:20'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-HUMEYRA', 'HÜMEYRA', '107', '13:00', '15:20'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-SEVDE', 'SEVDE', '108', '13:00', '15:20'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-KIMIA', 'KIMIA', '105', '15:30', '17:50'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-ONUR', 'ONUR', '106', '15:30', '17:50'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-HUMEYRA', 'HÜMEYRA', '107', '15:30', '17:50'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-SEVDE', 'SEVDE', '108', '15:30', '17:50')
    ) as c(class_key, teacher_code, teacher_name, room, starts_at, ends_at)
    join public.teachers t on t.employee_code = c.teacher_code
  loop
    teacher_uuid := row_data.teacher_id;
    class_name := 'American Life Summer School - ' || to_char(row_data.starts_at, 'HH24:MI') || '-' || to_char(row_data.ends_at, 'HH24:MI') || ' - ' || row_data.teacher_name || ' - Room ' || row_data.room;

    select id
    into existing_class_id
    from public.classes
    where name = class_name
      and teacher_id = teacher_uuid
    order by created_at desc
    limit 1;

    if existing_class_id is null then
      insert into public.classes (
        teacher_id,
        name,
        language,
        level,
        status,
        capacity,
        start_date,
        end_date,
        schedule,
        location,
        meeting_url
      )
      values (
        teacher_uuid,
        class_name,
        'English',
        'beginner',
        'active',
        16,
        current_date,
        current_date + interval '8 weeks',
        jsonb_build_array(jsonb_build_object(
          'days', 'Monday-Wednesday',
          'starts_at', to_char(row_data.starts_at, 'HH24:MI'),
          'ends_at', to_char(row_data.ends_at, 'HH24:MI'),
          'source_sheet', 'YAZ OKULU-SINIF PLANLANMASI(TAS'
        )),
        'Room ' || row_data.room,
        null
      )
      returning id into existing_class_id;
    else
      update public.classes
      set
        language = 'English',
        level = 'beginner',
        status = 'active',
        capacity = 16,
        start_date = current_date,
        end_date = current_date + interval '8 weeks',
        schedule = jsonb_build_array(jsonb_build_object(
          'days', 'Monday-Wednesday',
          'starts_at', to_char(row_data.starts_at, 'HH24:MI'),
          'ends_at', to_char(row_data.ends_at, 'HH24:MI'),
          'source_sheet', 'YAZ OKULU-SINIF PLANLANMASI(TAS'
        )),
        location = 'Room ' || row_data.room,
        meeting_url = null
      where id = existing_class_id;
    end if;

    insert into public.lessons (
      class_id,
      teacher_id,
      lesson_date,
      starts_at,
      ends_at,
      title,
      objectives,
      materials,
      homework,
      status
    )
    values (
      existing_class_id,
      teacher_uuid,
      current_date,
      row_data.starts_at,
      row_data.ends_at,
      'Summer School Session - ' || row_data.teacher_name || ' Room ' || row_data.room,
      'Imported from visible yazokulu.xlsx worksheet.',
      null,
      null,
      'scheduled'
    )
    on conflict (class_id, lesson_date, starts_at) do update
    set
      teacher_id = excluded.teacher_id,
      ends_at = excluded.ends_at,
      title = excluded.title,
      objectives = excluded.objectives,
      status = excluded.status;
  end loop;
end $import$;

with
  enrollment_data(class_key, student_code) as (
    values
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-ABDULHAMID-OZTURK-2018-3013'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-AHSEN-MINA-KARATURK-2017-6978'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-DORUK-CAN-YILMAZ-2018-7049'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-DURU-TURE-2017-5092'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-ERTURAN-COBANOGLU-2017-6495'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-HASAN-ALI-ELMAS-2017-9155'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-LIVANUR-SUMER-2018-R18'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-NECMI-BERAT-GEZER-2018-3830'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-NURMINA-KANDEMIR-2018-8036'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-OMER-ALP-YESILYURT-2018-9240'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-SAMET-TAHA-ENGEZ-2018-R17'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-YUSUF-ISLAM-KARACA-2017-7173'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-AHMET-ENES-SAHIN-2014-5760'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-AKIF-EMIR-GUMUS-2015-3450'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-BERILSU-ACKGOZ-2014-2375'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-BETUL-EFSA-AKGUN-2013-1090'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-DERIN-IKRA-UZGENC-2016-0814'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-EZGI-ALCELIK-2016-0161'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-HIRANUR-CELIK-2016-8513'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-MELEK-KIYMET-BULUT-2015-5474'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-MIRAC-CELIK-2016-4021'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-REFIK-EFE-KUVELOGLU-2015-3862'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-SU-KALKANDELENLIOGLU-2016-7771'),
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-TUANA-YLDRM-2014-7405'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-ABDULKADIR-CENGIZ-AVSAR-2019-1950'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-ALI-ASAF-ALMAL-2018-0058'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-ALMILA-HIMMET-2017-2431'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-AYSE-ZEREN-AVSAR-2017-1950'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-AZRA-HATICE-SAHIN-2017-7013'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-DAMLA-KAYA-2018-9502'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-ESILA-AYDN-2017-3847'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-RALE-NIL-DUMAN-2019-7161'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-SARE-SU-DUMAN-2019-7161'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-YAGZ-ADEM-ESER-2018-8864'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-YAVUZ-SELIM-TASLAK-2017-3892'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-YUSUF-EREN-SAMI-2017-3042'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-ALI-ASAF-TEKGUL-2018-8739'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-ALP-KEREM-GOKTURK-2019-0266'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-AYSE-MEYRA-DIZMAN-2018-9232'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-AZAD-CIFCI-2019-3612'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-ECRIN-SARHAN-2018-2788'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-ESLEM-SARE-TEKIN-2018-4181'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-FIRAT-IDRIS-VARLI-2018-5136'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-RUZGAR-ASAF-AY-2018-0004'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-SADK-OZDEMIR-2016-8498'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-SARE-DEMIRHAP-2018-1055'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-YAVUZ-KORKMAZ-2017-8498'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-VISIBLE-ZEYD-TAHA-ILIDI-2018-5094'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-AHMET-EYDOGAN-2016-8401'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-ALIHAN-DUZGUN-2017-7821'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-BEYAZID-HIMMET-2017-R35'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-EBRAR-SULTAN-POLAT-2018-0025'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-FATIMA-DUZGUN-2018-8487'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-IKRA-NAZ-ANBAR-2019-R36'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-MIRAY-HIMMET-2017-R34'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-MUHAMMED-EYMEN-TEKIN-2018-9711'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-MUZAFFER-MERT-TEMIZ-2018-4171'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-NAZ-OZDEMIR-2017-4951'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-OMER-EROL-SIMSEK-2019-9241'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-VISIBLE-ZUMRA-EYDOGAN-2019-8401'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-AHMET-EMIN-CELIK-2016-1372'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-ASYA-CAGLAYAN-2016-2825'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-ASYA-OZER-2017-9818'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-AYHAN-BASAR-2017-0409'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-CEYLIN-MEDINE-DEMIR-2017-6113'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-CNAR-KEMAL-TUNC-2016-2618'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-ELIF-POLAT-2017-1882'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-ERTUGRUL-UNGOR-2016-7718'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-METE-KUVELOGLU-2016-8153'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-MIRAY-OZCAN-2016-4798'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-YUSUF-COLAK-2016-6357'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-VISIBLE-YUSUF-EMIR-SONMEZ-2017-7924'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-AYSE-SENA-OZGUN-2018-9818'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-BELINAY-YURTTAV-2017-7765'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-EYMEN-SARGNER-2017-3831'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-EYUP-AYAZ-2017-4082'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-HIFA-ZEHRA-BERBER-2018-8175'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-IPEK-ELA-KORKMAZ-2018-7985'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-KAREN-KAMAC-2017-2183'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-KEREM-KARABACAK-2017-8691'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-NIL-OZDEMIR-2018-4951'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-OYKU-ELIF-AYTEKIN-2018-4657'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-TANER-TUGRA-ERKARAMAN-2017-4723'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-VISIBLE-YAVUZ-SELIM-KUCUK-2018-6261')
  ),
  class_data(class_key, teacher_code, teacher_name, room, starts_at, ends_at) as (
    values
  ('VISIBLE-13:00-YAZ-ONUR-ROOM-106', 'YAZ-ONUR', 'ONUR', '106', '13:00', '15:20'),
  ('VISIBLE-13:00-YAZ-HUMEYRA-ROOM-107', 'YAZ-HUMEYRA', 'HÜMEYRA', '107', '13:00', '15:20'),
  ('VISIBLE-13:00-YAZ-SEVDE-ROOM-108', 'YAZ-SEVDE', 'SEVDE', '108', '13:00', '15:20'),
  ('VISIBLE-15:30-YAZ-KIMIA-ROOM-105', 'YAZ-KIMIA', 'KIMIA', '105', '15:30', '17:50'),
  ('VISIBLE-15:30-YAZ-ONUR-ROOM-106', 'YAZ-ONUR', 'ONUR', '106', '15:30', '17:50'),
  ('VISIBLE-15:30-YAZ-HUMEYRA-ROOM-107', 'YAZ-HUMEYRA', 'HÜMEYRA', '107', '15:30', '17:50'),
  ('VISIBLE-15:30-YAZ-SEVDE-ROOM-108', 'YAZ-SEVDE', 'SEVDE', '108', '15:30', '17:50')
  ),
  resolved_classes as (
    select
      c.class_key,
      cls.id as class_id
    from class_data c
    join public.teachers t on t.employee_code = c.teacher_code
    join public.classes cls
      on cls.teacher_id = t.id
      and cls.name = 'American Life Summer School - ' || to_char(c.starts_at::time, 'HH24:MI') || '-' || to_char(c.ends_at::time, 'HH24:MI') || ' - ' || c.teacher_name || ' - Room ' || c.room
  )
insert into public.class_students (
  class_id,
  student_id,
  status,
  joined_at
)
select
  rc.class_id,
  s.id,
  'active',
  current_date
from enrollment_data e
join resolved_classes rc on rc.class_key = e.class_key
join public.students s on s.student_code = e.student_code
on conflict on constraint class_students_pkey do update
set
  status = excluded.status,
  joined_at = excluded.joined_at,
  left_at = null;

commit;
