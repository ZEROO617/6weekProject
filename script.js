// ============================================================================
// 바이브 카페 - 무인 결제 키오스크 로직
// 전역 오염을 막기 위해 모든 코드를 DOMContentLoaded 리스너 내부에서 실행
// ============================================================================

// 초보자 가이드: Supabase 프로젝트 설정 값
// - SUPABASE_URL: Supabase 프로젝트의 "Project URL" (예: https://xxxxx.supabase.co)
// - SUPABASE_KEY: Supabase 프로젝트의 "anon public" API 키
// 두 값은 Supabase 대시보드 > Project Settings > API 메뉴에서 확인할 수 있다.
// 아래 빈 문자열에 본인 값을 직접 채워 넣으면 된다.
const SUPABASE_URL = 'https://cpoglovjzzydvjeuhliy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwb2dsb3Zqenp5ZHZqZXVobGl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MjQzNDYsImV4cCI6MjEwNzAwMDM0Nn0._airD4d1spuy3_R3zpbQJgtl8Vq3PUhUBkMTlEa29kI';

// index.html에서 supabase-js CDN 스크립트를 script.js보다 먼저 불러왔기 때문에
// 전역 객체 window.supabase가 준비되어 있고, 이를 이용해 클라이언트를 생성한다.
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', function () {

  // --------------------------------------------------------------------------
  // 0. 상태 관리 (State)
  // 접수된 주문들을 보관하는 배열. 새 주문이 들어올 때마다 push되고,
  // 이 배열 전체를 기준으로 renderOrderHistory()가 화면을 다시 그린다.
  // --------------------------------------------------------------------------
  const orderHistory = [];

  // --------------------------------------------------------------------------
  // 1. 요소 캐싱
  // DOM 탐색 비용을 줄이기 위해 앞으로 반복해서 사용할 요소들을 한 번만 조회해 변수에 저장
  // --------------------------------------------------------------------------
  const orderForm = document.getElementById('order-form');
  const nameInput = document.getElementById('name');
  const drinkSelect = document.getElementById('drink');
  const quantityInput = document.getElementById('quantity');
  const estimatedPriceEl = document.getElementById('estimated-price');
  const orderConfirmationEl = document.getElementById('order-confirmation');
  const orderBtnEl = document.getElementById('order-btn'); // 저장 중 중복 클릭 방지를 위해 캐싱

  // 사이즈 라디오 버튼들 (name="size")과 추가 옵션 체크박스들 (name="options")
  const sizeRadios = orderForm.querySelectorAll('input[name="size"]');
  const optionCheckboxes = orderForm.querySelectorAll('input[name="options"]');

  // 탭 전환에 필요한 버튼과 패널 요소
  const tabOrderBtn = document.getElementById('tab-btn-order');
  const tabHistoryBtn = document.getElementById('tab-btn-history');
  const orderPanelEl = document.getElementById('order-panel');
  const historyPanelEl = document.getElementById('history-panel');

  // 주문 내역 화면의 빈 상태 안내문과 카드 목록 컨테이너
  const orderHistoryEmptyEl = document.getElementById('order-history-empty');
  const orderHistoryListEl = document.getElementById('order-history-list');

  // --------------------------------------------------------------------------
  // 2. 실시간 금액 계산 로직
  // 음료 기본 가격 + 사이즈 추가 금액 + 선택된 옵션 금액 합계, 그 결과에 수량을 곱한다
  // --------------------------------------------------------------------------
  function calculateTotal() {
    // 음료를 선택하지 않았다면(placeholder의 value는 빈 문자열) 금액을 0원으로 고정
    if (!drinkSelect.value) {
      estimatedPriceEl.textContent = '예상 금액: 0원';
      return 0;
    }

    // 현재 선택된 <option>의 data-price를 숫자로 안전하게 변환
    const selectedDrinkOption = drinkSelect.options[drinkSelect.selectedIndex];
    const drinkPrice = parseInt(selectedDrinkOption.dataset.price, 10) || 0;

    // 체크된 사이즈 라디오의 data-price를 숫자로 변환 (선택이 없으면 0원 처리)
    const checkedSizeRadio = orderForm.querySelector('input[name="size"]:checked');
    const sizePrice = checkedSizeRadio ? (parseInt(checkedSizeRadio.dataset.price, 10) || 0) : 0;

    // 체크된 추가 옵션들의 data-price를 모두 더함
    let optionsPrice = 0;
    optionCheckboxes.forEach(function (checkbox) {
      if (checkbox.checked) {
        optionsPrice += parseInt(checkbox.dataset.price, 10) || 0;
      }
    });

    // 수량은 최소 1 이상이 되도록 방어적으로 처리 (빈 값/음수/문자 입력 대비)
    const quantity = Math.max(1, parseInt(quantityInput.value, 10) || 1);

    // 최종 금액 = (음료 + 사이즈 + 옵션 합계) * 수량
    const total = (drinkPrice + sizePrice + optionsPrice) * quantity;

    // 천 단위 콤마를 적용하여 화면에 출력
    estimatedPriceEl.textContent = '예상 금액: ' + total.toLocaleString('ko-KR') + '원';

    return total;
  }

  // --------------------------------------------------------------------------
  // 3. 주문 완료 메시지 표시/숨김 헬퍼
  // .hidden 클래스를 제거/추가하는 방식으로 상태를 제어
  // (초기 HTML은 hidden 속성으로 숨겨져 있으므로, 보여줄 때 속성도 함께 해제한다)
  // --------------------------------------------------------------------------
  function showConfirmation(message) {
    orderConfirmationEl.textContent = message;
    orderConfirmationEl.classList.remove('hidden');
    orderConfirmationEl.hidden = false;
  }

  function hideConfirmation() {
    orderConfirmationEl.textContent = '';
    orderConfirmationEl.classList.add('hidden');
    orderConfirmationEl.hidden = true;
  }

  // --------------------------------------------------------------------------
  // 4. 탭 전환 (주문하기 화면 ↔ 주문 내역 화면)
  // 활성 탭 패널만 노출하고, 비활성 패널은 .hidden 클래스로 감춘다.
  // 탭 버튼에는 active 클래스를 토글해 현재 선택된 탭을 시각적으로 표시한다.
  // --------------------------------------------------------------------------
  function switchTab(tabName) {
    const isOrderTab = tabName === 'order';

    // 패널 표시/숨김: 활성 탭이 아닌 패널에 .hidden 클래스를 부여
    orderPanelEl.classList.toggle('hidden', !isOrderTab);
    historyPanelEl.classList.toggle('hidden', isOrderTab);

    // 탭 버튼 활성 상태 스타일 토글
    tabOrderBtn.classList.toggle('active', isOrderTab);
    tabHistoryBtn.classList.toggle('active', !isOrderTab);
  }

  // --------------------------------------------------------------------------
  // 5. 주문 내역 동적 렌더링
  // orderHistory 배열 전체를 순회하며 영수증 카드 UI를 생성한다.
  // 사용자 입력값은 textContent로만 삽입하므로 스크립트 삽입(XSS) 위험이 없다.
  // --------------------------------------------------------------------------
  function renderOrderHistory() {
    // 목록 컨테이너를 비우고 다시 그린다 (삽입할 값이 없으므로 innerHTML 초기화는 안전)
    orderHistoryListEl.innerHTML = '';

    // 주문이 하나도 없으면 안내 문구만 보여주고 종료
    if (orderHistory.length === 0) {
      orderHistoryEmptyEl.classList.remove('hidden');
      return;
    }
    orderHistoryEmptyEl.classList.add('hidden');

    // 최근 주문이 위쪽에 보이도록 원본 배열은 건드리지 않고 복사본을 뒤집어 순회
    const reversedOrders = orderHistory.slice().reverse();

    reversedOrders.forEach(function (order, index) {
      // 접수 순서 기준 주문 번호 (가장 먼저 접수된 주문이 1번)
      const orderNumber = orderHistory.length - index;

      // 카드 바깥 컨테이너
      const card = document.createElement('article');
      card.className = 'history-card';

      // 카드 상단: 주문 번호 + 주문 일시
      const header = document.createElement('div');
      header.className = 'history-card-header';

      const orderNumberEl = document.createElement('span');
      orderNumberEl.className = 'history-order-number';
      orderNumberEl.textContent = '주문번호 ' + orderNumber; // 텍스트 노드로 삽입 (XSS 방지)

      const orderTimeEl = document.createElement('span');
      orderTimeEl.className = 'history-order-time';
      orderTimeEl.textContent = order.orderTime;

      header.appendChild(orderNumberEl);
      header.appendChild(orderTimeEl);

      // 고객명
      const customerEl = document.createElement('p');
      customerEl.className = 'history-customer';
      customerEl.textContent = order.customerName + '님';

      // 메뉴 상세: 음료명 + 사이즈 + (옵션 목록) + 수량
      const menuEl = document.createElement('p');
      menuEl.className = 'history-menu';
      let menuText = order.beverageName + ' ' + order.size;
      if (order.options.length > 0) {
        menuText += ' (' + order.options.join(', ') + ')';
      }
      menuText += ' x ' + order.quantity;
      menuEl.textContent = menuText;

      // 최종 결제 금액
      const priceEl = document.createElement('p');
      priceEl.className = 'history-price';
      priceEl.textContent = '총 ' + order.totalPrice.toLocaleString('ko-KR') + '원';

      card.appendChild(header);
      card.appendChild(customerEl);
      card.appendChild(menuEl);
      card.appendChild(priceEl);

      orderHistoryListEl.appendChild(card);
    });
  }

  // --------------------------------------------------------------------------
  // 6. 주문 폼 필드 초기화
  // "다시 작성" 버튼과 "주문 접수 완료 후 자동 초기화"에서 공통으로 사용하는 로직
  // 사이즈는 M, 수량은 1로 명시적으로 되돌리고, 예상 금액도 함께 재계산한다.
  // --------------------------------------------------------------------------
  function resetFormFields() {
    nameInput.value = '';
    orderForm.elements.phone.value = '';
    drinkSelect.value = '';
    orderForm.elements.request.value = '';

    // 추가 옵션 체크박스 전체 해제
    optionCheckboxes.forEach(function (checkbox) {
      checkbox.checked = false;
    });

    // 사이즈 기본값(M)으로 명시적 복원
    const sizeMRadio = document.getElementById('size-m');
    if (sizeMRadio) {
      sizeMRadio.checked = true;
    }

    // 수량 기본값(1)으로 명시적 복원
    quantityInput.value = 1;

    // 금액 표시를 기본 상태(0원)로 동기화
    calculateTotal();
  }

  // --------------------------------------------------------------------------
  // 7. 주문 유효성 검증 및 제출 처리
  // Supabase에 실제로 저장하는 작업이 들어있으므로 async 함수로 작성한다.
  // --------------------------------------------------------------------------
  async function handleOrderSubmit(event) {
    // novalidate가 걸려있으므로 폼의 기본 제출 동작(페이지 새로고침)을 막는다
    event.preventDefault();

    // 7-1. 이름 검증: 공백만 입력한 경우도 걸러내기 위해 trim() 사용
    const customerName = nameInput.value.trim();
    if (!customerName) {
      alert('이름을 입력해주세요');
      return;
    }

    // 7-2. 음료 선택 검증
    if (!drinkSelect.value) {
      alert('음료를 선택해주세요');
      return;
    }

    // 7-3. 메시지 조립 및 저장에 필요한 값들을 모은다

    // 음료명: "아메리카노 3,500원" 형태의 텍스트에서 첫 단어(음료 이름)만 추출
    const selectedDrinkOption = drinkSelect.options[drinkSelect.selectedIndex];
    const drinkName = selectedDrinkOption.text.split(' ')[0];

    // 음료 자체의 기본 가격 (사이즈/옵션이 반영되기 전 가격)
    const drinkPrice = parseInt(selectedDrinkOption.dataset.price, 10) || 0;

    // 사이즈 라벨: 라디오의 value(s/m/l)를 대문자로 변환해 "S", "M", "L"로 표시
    const checkedSizeRadio = orderForm.querySelector('input[name="size"]:checked');
    const sizeLabel = checkedSizeRadio ? checkedSizeRadio.value.toUpperCase() : '';

    // 선택된 추가 옵션들의 이름을 라벨 텍스트에서 추출하여 배열로 수집
    const selectedOptionNames = [];
    optionCheckboxes.forEach(function (checkbox) {
      if (checkbox.checked) {
        const relatedLabel = orderForm.querySelector('label[for="' + checkbox.id + '"]');
        // "샷 추가 (+500원)" 형태에서 "(+" 앞부분만 잘라내어 "샷 추가"만 남긴다
        const optionName = relatedLabel.textContent.split(' (+')[0].trim();
        selectedOptionNames.push(optionName);
      }
    });

    // 옵션이 하나도 없으면 괄호 문구 전체를 생략, 있으면 "(샷 추가, 시럽 추가)" 형태로 조립
    const optionsText = selectedOptionNames.length > 0
      ? ' (' + selectedOptionNames.join(', ') + ')'
      : '';

    const quantity = Math.max(1, parseInt(quantityInput.value, 10) || 1);
    const requestText = orderForm.elements.request.value.trim();
    const phoneValue = orderForm.elements.phone.value.trim();

    // 최신 상태 기준으로 최종 금액을 다시 계산 (화면 표시값과 동기화)
    const total = calculateTotal();

    // 7-4. 저장하는 동안 주문하기 버튼을 비활성화해서 중복 클릭(중복 저장)을 막는다
    orderBtnEl.disabled = true;

    try {
      // 7-5. Supabase의 cafe_menu 테이블에 주문 1건을 저장
      // insert()는 실패해도 예외를 던지지 않고 { data, error } 형태로 결과를 돌려주므로
      // error 값이 있는지 직접 확인해야 한다.
      const { error } = await supabaseClient
        .from('cafe_menu')
        .insert([
          {
            customer_name: customerName,
            phone: phoneValue,
            drink: drinkName,
            drink_price: drinkPrice,
            size: sizeLabel,
            options: selectedOptionNames, // 배열 그대로 저장 (Supabase의 text[] 컬럼)
            quantity: quantity,
            request: requestText,
            total_price: total
          }
        ]);

      // error가 존재하면 저장 실패로 판단하고 사용자에게 알린다
      if (error) {
        console.error('주문 저장 실패:', error);
        alert('주문 저장에 실패했어요');
        return;
      }

      // 7-6. 저장 성공 시: 화면에서 보여줄 주문 내역 상태에도 동일하게 반영
      const newOrder = {
        id: Date.now(),
        customerName: customerName,
        beverageName: drinkName,
        size: sizeLabel,
        options: selectedOptionNames,
        quantity: quantity,
        totalPrice: total,
        orderTime: new Date().toLocaleString('ko-KR')
      };
      orderHistory.push(newOrder);
      renderOrderHistory();

      // 7-7. 최종 안내 문구 조립 및 화면 표시 (주문하기 화면에 그대로 노출)
      const confirmationMessage =
        customerName + '님, ' +
        drinkName + ' ' + sizeLabel + optionsText + ' ' +
        quantity + '잔, 총 ' + total.toLocaleString('ko-KR') + '원 주문이 접수되었습니다!';

      showConfirmation(confirmationMessage);

      // 7-8. 다음 손님을 위해 주문 폼을 자동으로 초기화 (확인 메시지는 그대로 유지)
      resetFormFields();
    } catch (err) {
      // 네트워크 오류 등 예상치 못한 예외도 동일하게 처리
      console.error('주문 저장 중 예외 발생:', err);
      alert('주문 저장에 실패했어요');
    } finally {
      // 성공/실패와 관계없이 버튼은 다시 눌러볼 수 있도록 복구
      orderBtnEl.disabled = false;
    }
  }

  // --------------------------------------------------------------------------
  // 8. "다시 작성" 버튼 클릭 처리
  // 네이티브 reset 대신 직접 필드를 제어하여 사이즈/수량 기본값과 메시지 숨김을
  // 한 번에, 예측 가능하게 처리한다.
  // --------------------------------------------------------------------------
  function handleFormReset(event) {
    event.preventDefault();
    resetFormFields();
    hideConfirmation();
  }

  // --------------------------------------------------------------------------
  // 9. 이벤트 리스너 등록
  // --------------------------------------------------------------------------

  // 음료 선택이 바뀔 때마다 금액 재계산
  drinkSelect.addEventListener('change', calculateTotal);

  // 사이즈 라디오 중 하나라도 바뀌면 금액 재계산
  sizeRadios.forEach(function (radio) {
    radio.addEventListener('change', calculateTotal);
  });

  // 추가 옵션 체크박스가 바뀔 때마다 금액 재계산
  optionCheckboxes.forEach(function (checkbox) {
    checkbox.addEventListener('change', calculateTotal);
  });

  // 수량은 타이핑 중에도 즉시 반영되도록 input 이벤트 사용
  quantityInput.addEventListener('input', calculateTotal);

  // 주문하기(submit) / 다시 작성(reset) 이벤트 연결
  orderForm.addEventListener('submit', handleOrderSubmit);
  orderForm.addEventListener('reset', handleFormReset);

  // 탭 버튼 클릭 시 화면 전환
  tabOrderBtn.addEventListener('click', function () {
    switchTab('order');
  });
  tabHistoryBtn.addEventListener('click', function () {
    switchTab('history');
  });

  // --------------------------------------------------------------------------
  // 10. 초기 상태 동기화
  // 페이지가 처음 열렸을 때 예상 금액과 주문 내역(빈 상태 문구)을 한 번씩 그려둔다
  // --------------------------------------------------------------------------
  calculateTotal();
  renderOrderHistory();
});
