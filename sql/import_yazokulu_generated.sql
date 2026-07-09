-- Generated from yazokulu.xlsx for American Life Summer School.
-- Source worksheet: YAZ OKULU 1 TEMMUZ-1 AĞUSTOS 20
-- Safe to re-run. Teachers/students are upserted by stable codes; classes are matched by deterministic names.
-- Fully self-contained: this file does not rely on temporary or staging tables.
--
-- Important:
-- The source worksheet displays 14:00-16:20 and 16:30-18:50.
-- This import maps them to the requested app sessions 13:00-15:20 and 15:30-17:50.

begin;

with teacher_data(employee_code, display_name, bio) as (
  values
  ('YAZ-HEBA', 'HEBA', 'Imported from yazokulu.xlsx'),
  ('YAZ-RESUL', 'RESUL', 'Imported from yazokulu.xlsx'),
  ('YAZ-SAEIDE', 'SAEIDE', 'Imported from yazokulu.xlsx')
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

with student_data(student_code, full_name, birth_year, phone, notes) as (
  values
  ('YAZ-AHMET-EYMEN-OZDEN-2015', 'Ahmet Eymen Özden', 2015, null, 'iade edildi'),
  ('YAZ-ARJIN-EVLIYAOGLU-2014', 'Arjin Evliyaoğlu', 2014, null, null),
  ('YAZ-ASL-KLC-2014', 'Aslı Kılıç', 2014, null, 'iade edildi'),
  ('YAZ-ASLAN-TAYLAN-POLAT-2012', 'Aslan Taylan polat', 2012, null, 'para iade edildi'),
  ('YAZ-ASMIN-AKTURK-2015', 'Asmin Aktürk', 2015, null, null),
  ('YAZ-AYSE-MINA-KURHAN-2016', 'Ayşe Mina Kurhan', 2016, null, null),
  ('YAZ-BAHADR-GUNEY-DEMIRBAS-2013', 'Bahadır Güney Demirbaş', 2013, null, 'açmadı'),
  ('YAZ-BAHAR-DEMIRBAS-2015', 'Bahar Demirbaş', 2015, null, 'açmadı'),
  ('YAZ-BERIL-SU-ACKGOZ-2014', 'Beril Su Açıkgöz', 2014, null, null),
  ('YAZ-BERRA-BUSU-2014', 'Berra Büşü', 2014, null, null),
  ('YAZ-BULUT-CNAR-DEMIR-2014', 'Bulut Çınar Demir', 2014, null, null),
  ('YAZ-CNAR-EYMEN-SUTCU-2014', 'Çınar Eymen Sütcü', 2014, null, 'iade edildi'),
  ('YAZ-DEFNE-BASKAN-2015', 'Defne Başkan', 2015, null, 'iade edildi'),
  ('YAZ-DEFNE-COLAK-2017', 'Defne Çolak', 2017, null, 'gelmeyecek'),
  ('YAZ-DERIN-LINA-KARAKOC-2018', 'Derin Lina Karakoç', 2018, null, 'yarın'),
  ('YAZ-DURU-SENA-AKDAG-2013', 'Duru Sena Akdağ', 2013, null, 'para iade edildi'),
  ('YAZ-DURU-TURE-2017', 'Duru Türe', 2017, null, null),
  ('YAZ-DUYGU-TERZI-NOYEAR', 'Duygu Terzi', null, null, null),
  ('YAZ-EDIZ-CNAR-KURHAN-2013', 'Ediz Çınar Kurhan', 2013, null, 'belli değil'),
  ('YAZ-EFE-EGE-ALTUN-2013', 'Efe Ege Altun', 2013, null, null),
  ('YAZ-ELIF-HIRA-CAPOGLU-2015', 'Elif Hira Çapoğlu', 2015, null, 'para taksit ödemesine eklendi'),
  ('YAZ-ELIF-KAR-2016', 'Elif Kar', 2016, null, 'iade edildi'),
  ('YAZ-ELINA-DEMIR-2017', 'Elina Demir', 2017, null, null),
  ('YAZ-EMIR-ONER-2015', 'Emir Öner', 2015, null, 'iade edildi'),
  ('YAZ-ENSAR-MIRAC-DEMIR-2017', 'Ensar Miraç Demir', 2017, null, null),
  ('YAZ-ESILA-FEYZAN-UZGENC-2014', 'Esila Feyzan Uzgenç', 2014, null, null),
  ('YAZ-ESILA-GURLUK-2016', 'Esila Gürlük', 2016, null, null),
  ('YAZ-ESILAMINA-OZDEMIR-2017', 'Esilamina Özdemir', 2017, null, 'iade'),
  ('YAZ-EYUP-TALHA-OZDEMIR-NOYEAR', 'Eyüp Talha Özdemir', null, null, 'iade'),
  ('YAZ-FATIH-TOSUN-2012', 'Fatih Tosun', 2012, null, 'iade edildi'),
  ('YAZ-FURKAN-EMIR-BOLAT-2015', 'Furkan Emir Bolat', 2015, null, null),
  ('YAZ-HILAL-DUMAN-2016', 'Hilal Duman', 2016, null, null),
  ('YAZ-HIRA-NUR-TOSUN-2015', 'Hira Nur Tosun', 2015, null, 'iade edildi'),
  ('YAZ-KAAN-FIDAN-2016', 'Kaan Fidan', 2016, null, 'iade edildi'),
  ('YAZ-KAMIL-EFE-SARSOY-NOYEAR', 'Kamil Efe Sarısoy', null, null, 'iade'),
  ('YAZ-KEREM-KAR-2012', 'Kerem Kar', 2012, null, 'iade edildi'),
  ('YAZ-KUBRA-UZUN-2016', 'Kübra Uzun', 2016, null, 'ok'),
  ('YAZ-LINA-DEMIR-2015', 'Lina Demir', 2015, null, null),
  ('YAZ-MEHMET-ZIYA-DEMIR-2015', 'Mehmet Ziya Demir', 2015, null, null),
  ('YAZ-MERT-KAGAN-KOK-NOYEAR', 'Mert Kağan KÖK', null, null, null),
  ('YAZ-MERYEM-NISA-ERDEM-2013', 'Meryem Nisa Erdem', 2013, null, 'ok'),
  ('YAZ-MEVA-AKBABA-2015', 'Meva Akbaba', 2015, null, 'iade edildi'),
  ('YAZ-MIRAC-KURT-2014', 'Miraç Kurt', 2014, null, 'iade edildi'),
  ('YAZ-MIRAC-URAS-ULUS-2016', 'Miraç Uras Ulus', 2016, null, 'iade'),
  ('YAZ-MUHAMMET-EMIR-TAYANC-2017', 'Muhammet Emir Tayanç', 2017, null, 'iade edildi'),
  ('YAZ-NEHIR-TUNC-2016', 'Nehir Tunç', 2016, null, 'iade edildi'),
  ('YAZ-NILAY-ALTUN-2016', 'Nilay Altun', 2016, null, null),
  ('YAZ-NISA-NUR-DASDEMIR-2015', 'Nisa Nur Daşdemir', 2015, null, 'gelmeyecek'),
  ('YAZ-OGUZHAN-BERKE-BAYHAN-2015', 'Oğuzhan Berke Bayhan', 2015, null, 'iade edildi'),
  ('YAZ-OMER-GENC-VE-SELIM-GENC-2016', 'Ömer Genç ve Selim Genç', 2016, null, 'gelmeyecek'),
  ('YAZ-OZAN-GUZEL-2013', 'Ozan Güzel', 2013, null, null),
  ('YAZ-POYRAZ-EYMEN-MALCOK-2016', 'Poyraz Eymen Malçok', 2016, null, 'para iade edildi'),
  ('YAZ-SALIH-ILHAN-POLAT-2013', 'Salih İlhan Polat', 2013, null, null),
  ('YAZ-SARYA-EVLIAOGLU-2016', 'Sarya Evliaoğlu', 2016, null, 'gelmeyecek'),
  ('YAZ-SEYYID-OMER-KVRAK-2017', 'Seyyid Ömer Kıvrak', 2017, null, null),
  ('YAZ-SUKRIYE-BETUL-KARACA-2011', 'Şükriye Betül Karaca', 2011, null, 'iade edildi'),
  ('YAZ-TARK-ZIYAD-ELMAS-2019', 'Tarık Ziyad Elmas', 2019, null, null),
  ('YAZ-UMUT-AKDAG-2016', 'Umut Akdağ', 2016, null, 'para iade edildi'),
  ('YAZ-YAREN-CETINEL-2015', 'Yaren Çetinel', 2015, null, null),
  ('YAZ-YIGIT-BIROL-2015', 'Yiğit Birol', 2015, null, 'açmadı'),
  ('YAZ-YUNUS-EMRE-ELMAS-2018', 'Yunus Emre Elmas', 2018, null, null),
  ('YAZ-YUSUF-MIRAC-YLDZ-2014', 'Yusuf Miraç Yıldız', 2014, null, 'gelmeyecek'),
  ('YAZ-YUSUF-MIRZA-SURUCU-2015', 'Yusuf Mirza Sürücü', 2015, null, 'iade edildi'),
  ('YAZ-YUSUF-YAGZ-OZDEMIR-2015', 'Yusuf Yağız Özdemir', 2015, null, 'iade'),
  ('YAZ-ZARIF-DEVRAN-AKTURK-2015', 'Zarif Devran Aktürk', 2015, null, null),
  ('YAZ-ZUMRA-COLAKEL-2015', 'Zümra Çolakel', 2015, null, null),
  ('YAZ-ZUMRA-MERYEM-CELIK-2012', 'Zümra Meryem Çelik', 2012, null, null),
  ('YAZ-ZUMRUT-ASYA-YELIN-2016', 'Zümrüt Asya Yelin', 2016, null, null)
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
  concat_ws('; ', 'Imported from yazokulu.xlsx', case when birth_year is null then null else 'Birth year: ' || birth_year::text end, notes)
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
      c.teacher_employee_code,
      c.teacher_name,
      c.room,
      c.source_time_label,
      c.starts_at::time as starts_at,
      c.ends_at::time as ends_at,
      t.id as teacher_id
    from (
      values
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-HEBA', 'HEBA', '103', '14:00-16:20', '13:00', '15:20'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-RESUL', 'RESUL', '105', '14:00-16:20', '13:00', '15:20'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-SAEIDE', 'SAEIDE', '106', '14:00-16:20', '13:00', '15:20'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-HEBA', 'HEBA', '103', '16:30-18:50', '15:30', '17:50'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-RESUL', 'RESUL', '105', '16:30-18:50', '15:30', '17:50'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-SAEIDE', 'SAEIDE', '106', '16:30-18:50', '15:30', '17:50')
    ) as c(class_key, teacher_employee_code, teacher_name, room, source_time_label, starts_at, ends_at)
    join public.teachers t on t.employee_code = c.teacher_employee_code
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
          'days', 'Monday-Thursday',
          'starts_at', to_char(row_data.starts_at, 'HH24:MI'),
          'ends_at', to_char(row_data.ends_at, 'HH24:MI'),
          'source_time', row_data.source_time_label
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
          'days', 'Monday-Thursday',
          'starts_at', to_char(row_data.starts_at, 'HH24:MI'),
          'ends_at', to_char(row_data.ends_at, 'HH24:MI'),
          'source_time', row_data.source_time_label
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
      'Imported session from yazokulu.xlsx.',
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
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-AHMET-EYMEN-OZDEN-2015'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-AYSE-MINA-KURHAN-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-DEFNE-COLAK-2017'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-ENSAR-MIRAC-DEMIR-2017'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-ESILA-GURLUK-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-KUBRA-UZUN-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-MIRAC-URAS-ULUS-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-MUHAMMET-EMIR-TAYANC-2017'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-NEHIR-TUNC-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-NILAY-ALTUN-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-OMER-GENC-VE-SELIM-GENC-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-POYRAZ-EYMEN-MALCOK-2016'),
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-ZUMRUT-ASYA-YELIN-2016'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-ASL-KLC-2014'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-BAHAR-DEMIRBAS-2015'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-BERIL-SU-ACKGOZ-2014'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-BERRA-BUSU-2014'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-CNAR-EYMEN-SUTCU-2014'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-ESILA-FEYZAN-UZGENC-2014'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-FURKAN-EMIR-BOLAT-2015'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-HIRA-NUR-TOSUN-2015'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-MERT-KAGAN-KOK-NOYEAR'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-MERYEM-NISA-ERDEM-2013'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-NISA-NUR-DASDEMIR-2015'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-YIGIT-BIROL-2015'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-BAHADR-GUNEY-DEMIRBAS-2013'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-DEFNE-BASKAN-2015'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-EDIZ-CNAR-KURHAN-2013'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-FATIH-TOSUN-2012'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-MIRAC-KURT-2014'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-SUKRIYE-BETUL-KARACA-2011'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-YUSUF-MIRAC-YLDZ-2014'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-YUSUF-MIRZA-SURUCU-2015'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-DERIN-LINA-KARAKOC-2018'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-DURU-TURE-2017'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-ELIF-KAR-2016'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-ELINA-DEMIR-2017'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-ESILAMINA-OZDEMIR-2017'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-HILAL-DUMAN-2016'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-KAAN-FIDAN-2016'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-SARYA-EVLIAOGLU-2016'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-SEYYID-OMER-KVRAK-2017'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-TARK-ZIYAD-ELMAS-2019'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-UMUT-AKDAG-2016'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-YUNUS-EMRE-ELMAS-2018'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-ASMIN-AKTURK-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-ELIF-HIRA-CAPOGLU-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-EMIR-ONER-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-EYUP-TALHA-OZDEMIR-NOYEAR'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-KAMIL-EFE-SARSOY-NOYEAR'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-LINA-DEMIR-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-MEHMET-ZIYA-DEMIR-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-MEVA-AKBABA-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-OGUZHAN-BERKE-BAYHAN-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-YAREN-CETINEL-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-YUSUF-YAGZ-OZDEMIR-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-ZARIF-DEVRAN-AKTURK-2015'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-ZUMRA-COLAKEL-2015'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-ARJIN-EVLIYAOGLU-2014'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-ASLAN-TAYLAN-POLAT-2012'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-BULUT-CNAR-DEMIR-2014'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-DURU-SENA-AKDAG-2013'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-DUYGU-TERZI-NOYEAR'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-EFE-EGE-ALTUN-2013'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-KEREM-KAR-2012'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-OZAN-GUZEL-2013'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-SALIH-ILHAN-POLAT-2013'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-ZUMRA-MERYEM-CELIK-2012')
  ),
  class_data(class_key, teacher_employee_code, teacher_name, room, source_time_label, starts_at, ends_at) as (
    values
  ('SUMMER-13:00-HEBA-ROOM-103', 'YAZ-HEBA', 'HEBA', '103', '14:00-16:20', '13:00', '15:20'),
  ('SUMMER-13:00-RESUL-ROOM-105', 'YAZ-RESUL', 'RESUL', '105', '14:00-16:20', '13:00', '15:20'),
  ('SUMMER-13:00-SAEIDE-ROOM-106', 'YAZ-SAEIDE', 'SAEIDE', '106', '14:00-16:20', '13:00', '15:20'),
  ('SUMMER-15:30-HEBA-ROOM-103', 'YAZ-HEBA', 'HEBA', '103', '16:30-18:50', '15:30', '17:50'),
  ('SUMMER-15:30-RESUL-ROOM-105', 'YAZ-RESUL', 'RESUL', '105', '16:30-18:50', '15:30', '17:50'),
  ('SUMMER-15:30-SAEIDE-ROOM-106', 'YAZ-SAEIDE', 'SAEIDE', '106', '16:30-18:50', '15:30', '17:50')
  ),
  resolved_classes as (
    select
      c.class_key,
      cls.id as class_id
    from class_data c
    join public.teachers t on t.employee_code = c.teacher_employee_code
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
