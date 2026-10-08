-- ============================================================================
-- 바이브 카페 키오스크 - 테스트용 주문 1건 입력
-- cafe_menu 테이블 구조(supabase_schema.sql)에 맞춘 샘플 데이터입니다.
-- ============================================================================

insert into public.cafe_menu (
  customer_name,
  phone,
  drink,
  drink_price,
  size,
  options,
  quantity,
  request,
  total_price
)
values (
  '홍길동',                       -- 이름
  '010-1234-5678',                -- 전화번호
  '카페라떼',                      -- 음료명
  4000,                            -- 음료 기본 가격
  'M',                             -- 사이즈
  array['샷 추가', '시럽 추가'],    -- 추가 옵션 목록
  2,                               -- 수량
  '얼음 적게 넣어주세요',           -- 요청사항
  9600                             -- 총 금액: (4000 + 0 + 500 + 300) * 2 = 9600원
);

-- 입력 결과 확인
select * from public.cafe_menu order by order_time desc limit 1;
