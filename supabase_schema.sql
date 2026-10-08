-- ============================================================================
-- 바이브 카페 키오스크 - Supabase 주문 테이블 스키마
-- script.js의 handleOrderSubmit()이 저장하는 컬럼 구성을 그대로 반영했습니다.
-- 테이블명(cafe_menu)은 과제에서 안내받은 본인 테이블명으로 자유롭게 바꿔도 됩니다.
-- ============================================================================

-- 주문 정보를 저장하는 테이블
create table if not exists public.cafe_menu (
  -- 기본키: Supabase 권장 방식인 uuid + gen_random_uuid() 사용
  id uuid primary key default gen_random_uuid(),

  -- 고객 정보
  customer_name text not null,          -- 이름 (필수)
  phone text,                           -- 전화번호 (선택)

  -- 주문 메뉴 정보
  drink text not null,                  -- 음료명 (예: 아메리카노)
  drink_price integer not null default 0, -- 음료 기본 가격(사이즈/옵션 반영 전)
  size text not null,                   -- 사이즈 (S / M / L)
  options text[] not null default '{}', -- 선택한 추가 옵션 목록 (예: {샷 추가, 시럽 추가})
  quantity integer not null default 1,  -- 수량

  -- 요청사항
  request text,                         -- 요청사항 (선택)

  -- 결제 정보
  total_price integer not null,         -- 최종 결제 금액(원)

  -- 주문 접수 시각 (DB가 자동으로 기록)
  order_time timestamptz not null default now(),

  -- 유효성 검증: 수량과 금액은 음수가 될 수 없도록 DB 레벨에서도 방어
  constraint cafe_menu_quantity_check check (quantity >= 1),
  constraint cafe_menu_total_price_check check (total_price >= 0)
);

-- 주문 내역 탭에서 최신순 조회가 빠르도록 인덱스 생성
create index if not exists cafe_menu_order_time_idx
  on public.cafe_menu (order_time desc);

-- ============================================================================
-- Row Level Security (RLS) 설정
-- 로그인 없이 쓰는 키오스크이므로 anon(비로그인) 키로 insert/select를 허용합니다.
-- ============================================================================
alter table public.cafe_menu enable row level security;

-- 누구나(비로그인 포함) 새 주문을 등록(INSERT)할 수 있도록 허용
create policy "Anyone can insert cafe_menu orders"
  on public.cafe_menu
  for insert
  to anon
  with check (true);

-- 누구나(비로그인 포함) 주문 내역을 조회(SELECT)할 수 있도록 허용
-- 매장 내부 키오스크 전용이라면 이 정책으로 충분하지만,
-- 외부에 공개되는 서비스라면 조회 범위를 더 제한하는 것을 권장합니다.
create policy "Anyone can view cafe_menu orders"
  on public.cafe_menu
  for select
  to anon
  using (true);
