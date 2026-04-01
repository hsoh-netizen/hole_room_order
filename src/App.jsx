import React, { useState, useEffect, useRef } from 'react';
// Lucide-react 라이브러리에서 사용할 아이콘들을 불러옵니다.
import { 
  Home, Settings, Bell, ShoppingCart, Check, X, 
  Plus, Edit, Trash2, List, UtensilsCrossed, MonitorPlay, 
  AlertCircle, Coffee, FileText, RotateCcw, 
  LogOut, User, Lock, Store, Key, LogIn, ShieldCheck, Activity, Users, Smartphone, Server
} from 'lucide-react';

// --- 파이어베이스(Firebase) 연동을 위한 모듈 로드 ---
// Firebase 앱 초기화 및 Firestore(실시간 데이터베이스) 사용을 위한 함수들입니다.
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";

// --- 고객님의 파이어베이스 설정값 적용 ---
// Firebase 콘솔에서 발급받은 고유 프로젝트 식별 정보입니다.
const firebaseConfig = {
  apiKey: "AIzaSyBpgZ2GJsSC8ZxNuEyct-oRcWXPLt2bptc",
  authDomain: "holeroomorder.firebaseapp.com",
  projectId: "holeroomorder",
  storageBucket: "holeroomorder.firebasestorage.app",
  messagingSenderId: "167618977732",
  appId: "1:167618977732:web:3a49ea5945ea2bdc470e91"
};

// 파이어베이스 초기화 (보안 인증 없이 테스트 모드로 접근하기 위해 Auth 기능은 제외됨)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 초기 더미 데이터 세팅 ---
// 데이터베이스가 완전히 비어있을 때 처음으로 채워 넣을 기본 메뉴 데이터입니다.
const INITIAL_MENU = [
  { id: 'm1', name: '아메리카노', price: 4500, description: '최고급 원두로 내린 아메리카노', image: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?auto=format&fit=crop&q=80&w=200&h=200', category: '음료' },
  { id: 'm2', name: '카페라떼', price: 5000, description: '부드러운 우유가 들어간 라떼', image: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&q=80&w=200&h=200', category: '음료' },
  { id: 'm3', name: '클럽 샌드위치', price: 8500, description: '신선한 야채와 베이컨이 들어간 샌드위치', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&q=80&w=200&h=200', category: '식사' },
  { id: 'm4', name: '감자튀김', price: 6000, description: '바삭하게 튀겨낸 감자튀김과 케찹', image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&q=80&w=200&h=200', category: '스낵' },
];

// 데이터베이스가 완전히 비어있을 때 처음으로 채워 넣을 기본 매장(admin) 구조입니다.
const INITIAL_STORES = {
  'admin': {
    password: 'admin',
    storeName: '룸오더 1호점 (데모)',
    rooms: [
      { id: 'room_1', name: '1번 방', loginId: 'room1', password: '1' },
      { id: 'room_2', name: '2번 방', loginId: 'room2', password: '2' },
    ],
    menuItems: INITIAL_MENU,
    orders: [],
    calls: []
  }
};


// ==========================================
// 최상위 메인 컴포넌트 (App)
// 앱의 전반적인 상태(Firebase 동기화, 세션, 라우팅)를 관장합니다.
// ==========================================
export default function App() {
  // [클라우드 데이터 상태 관리]
  // storesLocal: 전체 매장의 정보(메뉴, 룸, 주문, 호출)를 담는 객체
  // activeSessionsLocal: 현재 접속 중인 기기들의 온라인 상태를 기록하는 객체 (슈퍼바이저 모니터링용)
  const [storesLocal, setStoresLocal] = useState(null);
  const [activeSessionsLocal, setActiveSessionsLocal] = useState(null);
  
  // [세션 유지 관리]
  // 사용자가 F5(새로고침)를 눌러도 로그아웃되지 않도록 localStorage에서 세션을 꺼내옵니다.
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('room_order_session_v4');
    return saved ? JSON.parse(saved) : null;
  });
  
  // 전역 커스텀 모달(alert, confirm 대체)을 띄우기 위한 설정값 상태
  const [modalConfig, setModalConfig] = useState(null);

  // 이벤트 리스너(beforeunload 등) 안에서 최신 상태를 참조하기 위해 useRef를 사용해 상태값을 동기화해 둡니다.
  const sessionRef = useRef(session);
  const activeSessionsRef = useRef(activeSessionsLocal);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { activeSessionsRef.current = activeSessionsLocal; }, [activeSessionsLocal]);

  // 세션이 로그인되거나 로그아웃되어 변경될 때마다 로컬 스토리지에 즉시 반영합니다. (새로고침 방어)
  useEffect(() => {
    if (session) localStorage.setItem('room_order_session_v4', JSON.stringify(session));
    else localStorage.removeItem('room_order_session_v4');
  }, [session]);

  // --- [중요] 1. 파이어베이스 실시간 동기화 세팅 ---
  // 컴포넌트가 처음 마운트될 때 Firestore 데이터베이스와 연결(구독)합니다.
  useEffect(() => {
    // Firestore 내의 문서 경로를 지정합니다.
    const storesRef = doc(db, 'artifacts', 'holeroomorder', 'public', 'data', 'system', 'stores');
    const sessionsRef = doc(db, 'artifacts', 'holeroomorder', 'public', 'data', 'system', 'sessions');

    let isInitialStores = true;
    // onSnapshot: 데이터베이스의 내용이 바뀔 때마다 실시간으로 이 콜백 함수가 실행됩니다.
    const unsubStores = onSnapshot(storesRef, (docSnap) => {
      if (docSnap.exists()) {
        // DB에 데이터가 있으면 로컬 상태(storesLocal)를 업데이트하여 화면을 리렌더링시킵니다.
        setStoresLocal(docSnap.data().data);
      } else if (isInitialStores) {
        // DB가 텅 비어있다면, 초기 더미 데이터를 생성해 DB에 밀어 넣습니다.
        setDoc(storesRef, { data: INITIAL_STORES }).catch(console.error); 
      }
      isInitialStores = false;
    }, (error) => console.error(error));

    let isInitialSessions = true;
    const unsubSessions = onSnapshot(sessionsRef, (docSnap) => {
      if (docSnap.exists()) {
        setActiveSessionsLocal(docSnap.data().data);
      } else if (isInitialSessions) {
        setDoc(sessionsRef, { data: {} }).catch(console.error);
      }
      isInitialSessions = false;
    }, (error) => console.error(error));

    // 컴포넌트가 언마운트될 때(앱 종료 등) 구독을 해제합니다. 메모리 누수 방지.
    return () => { unsubStores(); unsubSessions(); };
  }, []);

  // --- 2. 온라인 상태 자동 복구 로직 ---
  // 새로고침을 하면 메모리상의 연결이 끊어져 오프라인으로 뜰 수 있으므로, 세션이 살아있다면 다시 '온라인'으로 DB에 기록합니다.
  useEffect(() => {
    if (!session || !activeSessionsLocal) return;
    let key;
    if (session.role === 'admin') key = `admin_${session.adminId}`;
    if (session.role === 'tablet') key = `tablet_${session.adminId}_${session.roomId}`;
    if (session.role === 'supervisor') key = 'supervisor';

    if (key && !activeSessionsLocal[key]) {
      const newSessions = { ...activeSessionsLocal, [key]: true };
      setDoc(doc(db, 'artifacts', 'holeroomorder', 'public', 'data', 'system', 'sessions'), { data: newSessions }).catch(console.error);
    }
  }, [session, activeSessionsLocal]);

  // --- 3. 접속 종료 (브라우저 닫기) 시 세션 정리 ---
  // 사용자가 브라우저 탭을 완전히 닫거나 이동할 때, 해당 기기의 상태를 오프라인으로 만들기 위해 기록을 지웁니다.
  useEffect(() => {
    const handleUnload = () => {
      const currentSession = sessionRef.current;
      if (currentSession && activeSessionsRef.current) {
        const parsed = { ...activeSessionsRef.current };
        if (currentSession.role === 'admin') delete parsed[`admin_${currentSession.adminId}`];
        if (currentSession.role === 'tablet') delete parsed[`tablet_${currentSession.adminId}_${currentSession.roomId}`];
        if (currentSession.role === 'supervisor') delete parsed['supervisor'];
        setDoc(doc(db, 'artifacts', 'holeroomorder', 'public', 'data', 'system', 'sessions'), { data: parsed });
      }
    };
    // 브라우저 내장 이벤트 'beforeunload' 활용
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // --- [버그수정 및 헬퍼 함수] Firebase 통신 헬퍼 ---
  
  // 전체 매장 데이터를 덮어쓸 때 사용하는 함수
  const setStores = (updateFn) => {
    setStoresLocal(prev => {
      const newVal = typeof updateFn === 'function' ? updateFn(prev) : updateFn;
      // 비동기 처리(setTimeout): React의 렌더링 흐름과 Firebase 저장 흐름이 엉켜 백화현상(White Screen)이 일어나는 것을 방지합니다.
      setTimeout(() => {
        setDoc(doc(db, 'artifacts', 'holeroomorder', 'public', 'data', 'system', 'stores'), { data: newVal }).catch(console.error);
      }, 0);
      return newVal;
    });
  };

  // 특정 매장(adminId)의 특정 키(orders, calls, rooms 등)만 안전하게 업데이트하는 핵심 함수
  const updateStore = (adminId, key, updateFn) => {
    setStoresLocal(prev => {
      if (!prev || !prev[adminId]) return prev; // 매장이 없으면 무시
      
      const isArrayKey = ['orders', 'calls', 'menuItems', 'rooms'].includes(key);
      // undefined 참조 에러 방지: 배열이어야 할 데이터가 비어있으면(undefined), 빈 배열([])로 기본값을 할당합니다. (백화현상 1차 차단)
      const currentVal = prev[adminId][key] || (isArrayKey ? [] : null);
      
      const updatedVal = typeof updateFn === 'function' ? updateFn(currentVal) : updateFn;
      const newStores = {
        ...prev,
        [adminId]: {
          ...prev[adminId],
          [key]: updatedVal
        }
      };
      
      // Firebase 통신 비동기 분리 (백화현상 2차 차단)
      setTimeout(() => {
        setDoc(doc(db, 'artifacts', 'holeroomorder', 'public', 'data', 'system', 'stores'), { data: newStores }).catch(console.error);
      }, 0);
      return newStores;
    });
  };

  // 접속 세션 정보를 업데이트하는 헬퍼 함수
  const setActiveSessions = (updateFn) => {
    setActiveSessionsLocal(prev => {
      const newVal = typeof updateFn === 'function' ? updateFn(prev) : updateFn;
      setTimeout(() => {
        setDoc(doc(db, 'artifacts', 'holeroomorder', 'public', 'data', 'system', 'sessions'), { data: newVal }).catch(console.error);
      }, 0);
      return newVal;
    });
  };

  // 안전하게 룸의 '이름(예: 1번 방)'을 찾아 반환하는 유틸 함수
  const getRoomName = (adminId, roomId) => {
    const safeStores = storesLocal || {};
    const safeStore = safeStores[adminId] || {};
    const rooms = safeStore.rooms || [];
    return rooms.find(r => r.id === roomId)?.name || '알 수 없는 룸';
  };

  // --- 파이어베이스 연결 대기 UI ---
  // 앱 최초 실행 시, 서버에서 데이터를 다 가져오기 전까지 보여주는 로딩 스피너입니다.
  if (!storesLocal || !activeSessionsLocal) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-sans">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-lg font-bold">클라우드 서버와 실시간 연결 중입니다...</p>
        <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요.</p>
      </div>
    );
  }

  // 로그인 처리: 로그인 성공 시 세션 객체를 저장하고, 온라인 상태로 등록
  const handleLogin = (newSession) => {
    setSession(newSession);
    setActiveSessions(prev => {
      const next = { ...prev };
      if (newSession.role === 'admin') next[`admin_${newSession.adminId}`] = true;
      if (newSession.role === 'tablet') next[`tablet_${newSession.adminId}_${newSession.roomId}`] = true;
      if (newSession.role === 'supervisor') next['supervisor'] = true;
      return next;
    });
  };

  // 로그아웃 처리: 온라인 상태를 삭제하고, 세션을 초기화
  const handleLogout = () => {
    setActiveSessions(prev => {
      const next = { ...prev };
      if (session.role === 'admin') delete next[`admin_${session.adminId}`];
      if (session.role === 'tablet') delete next[`tablet_${session.adminId}_${session.roomId}`];
      if (session.role === 'supervisor') delete next['supervisor'];
      return next;
    });
    setSession(null);
  };

  // 커스텀 모달 호출용 함수들 (alert, confirm, prompt 창을 브라우저 제약 없이 띄웁니다.)
  const showModal = (type, title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      setModalConfig({
        type, title, message, defaultValue,
        onConfirm: (val) => { setModalConfig(null); resolve(type === 'prompt' ? val : true); },
        onCancel: () => { setModalConfig(null); resolve(type === 'prompt' ? null : false); }
      });
    });
  };
  const showAlert = (title, message) => showModal('alert', title, message);
  const showConfirm = (title, message) => showModal('confirm', title, message);
  const showPrompt = (title, message, defaultValue = '') => showModal('prompt', title, message, defaultValue);

  // --- 뷰 라우팅 (화면 분기) ---
  // 세션이 없으면 로그인 화면을 렌더링
  if (!session) {
    return <AuthView stores={storesLocal} handleLogin={handleLogin} showAlert={showAlert} />;
  }

  // 세션 역할(role)에 따라 각각의 권한 화면을 렌더링합니다.
  return (
    <>
      {/* 슈퍼바이저 (마스터 관리자) 뷰 */}
      {session.role === 'supervisor' && (
        <SupervisorView 
          stores={storesLocal} setStores={setStores} activeSessions={activeSessionsLocal}
          logout={handleLogout} showAlert={showAlert} showConfirm={showConfirm}
        />
      )}
      {/* 매장 관리자(PC 카운터) 뷰 */}
      {session.role === 'admin' && (
        <AdminView 
          adminId={session.adminId} storeData={storesLocal[session.adminId]}
          updateStore={updateStore} getRoomName={(roomId) => getRoomName(session.adminId, roomId)}
          logout={handleLogout} showAlert={showAlert} showConfirm={showConfirm}
        />
      )}
      {/* 고객 사용자(태블릿) 뷰 */}
      {session.role === 'tablet' && (
        <TabletView 
          adminId={session.adminId} storeData={storesLocal[session.adminId]} roomId={session.roomId}
          updateStore={updateStore} logout={handleLogout} showAlert={showAlert} showConfirm={showConfirm}
        />
      )}
      {/* 공통 모달 렌더러 (설정값이 있을 때만 모달이 화면 위를 덮습니다) */}
      {modalConfig && <GlobalModal config={modalConfig} />}
    </>
  );
}

// ==========================================
// 로그인/접속 뷰 컴포넌트
// ==========================================
function AuthView({ stores, handleLogin, showAlert }) {
  // tab: 현재 선택된 로그인 탭 (admin, tablet, supervisor 중 하나)
  const [tab, setTab] = useState('admin');

  // 로그인 폼 제출(Submit) 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = fd.get('loginId');
    const pw = fd.get('password');

    if (tab === 'supervisor') {
      // 슈퍼바이저는 하드코딩된 고정 ID/PW를 사용합니다.
      if (id === 'ratel' && pw === '1q2w3e4r!') {
        handleLogin({ role: 'supervisor' });
      } else {
        await showAlert('인증 실패', '슈퍼바이저 계정 정보가 일치하지 않습니다.');
      }
    } else if (tab === 'admin') {
      // 매장 관리자 로그인 검증
      const safeStores = stores || {};
      if (safeStores[id] && safeStores[id].password === pw) {
        handleLogin({ role: 'admin', adminId: id });
      } else {
        await showAlert('로그인 실패', '매장 ID 또는 비밀번호가 일치하지 않습니다.');
      }
    } else {
      // 태블릿 로그인 검증: 모든 매장을 순회하며 룸 고유 접속 코드를 찾습니다.
      let found = false;
      const safeStores = stores || {};
      for (const [adminId, store] of Object.entries(safeStores)) {
        const safeStore = store || {};
        const rooms = safeStore.rooms || [];
        const room = rooms.find(r => r.loginId === id && r.password === pw);
        if (room) {
          handleLogin({ role: 'tablet', adminId, roomId: room.id });
          found = true;
          break;
        }
      }
      if (!found) await showAlert('접속 실패', '룸 ID 또는 비밀번호가 일치하지 않습니다.\n매장 관리자에게 문의하세요.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* 배경 블러 효과 장식 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 rounded-full blur-[100px]"></div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden z-10">
        {/* 상단 탭 메뉴 */}
        <div className="flex text-center border-b border-gray-100 bg-gray-50/50 text-sm">
          <button onClick={() => setTab('admin')} className={`flex-1 py-4 font-bold transition-colors ${tab === 'admin' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>매장 관리자</button>
          <button onClick={() => setTab('tablet')} className={`flex-1 py-4 font-bold transition-colors ${tab === 'tablet' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>룸 태블릿</button>
          <button onClick={() => setTab('supervisor')} className={`flex-1 py-4 font-bold transition-colors ${tab === 'supervisor' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>슈퍼바이저</button>
        </div>

        <div className="p-8">
          <div className="mb-8 text-center">
            {tab === 'supervisor' && <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-3" />}
            <h1 className="text-2xl font-black text-gray-900 mb-2">
              {tab === 'supervisor' ? 'SUPERVISOR SYSTEM' : 'ROOM ORDER SYSTEM'}
            </h1>
            <p className="text-gray-500 text-sm">
              {tab === 'supervisor' && '최고 관리자 관제 및 매장 관리 시스템'}
              {tab === 'admin' && '매장 관리자 계정으로 로그인하세요.'}
              {tab === 'tablet' && '할당받은 룸 접속 코드를 입력하세요.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {tab === 'supervisor' ? '슈퍼바이저 ID' : tab === 'admin' ? '매장 관리자 ID' : '룸 접속 ID'}
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input required name="loginId" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="아이디를 입력하세요" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input required type="password" name="password" className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all" placeholder="비밀번호를 입력하세요" />
              </div>
            </div>

            <button type="submit" className={`w-full text-white font-bold py-3.5 rounded-xl mt-6 shadow-md transition-colors flex justify-center items-center gap-2 ${tab === 'supervisor' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
              <LogIn className="w-5 h-5" /> 접속하기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 슈퍼바이저 뷰 (최고 관리자 전용 기능)
// 모든 매장을 생성/삭제하고, 룸(태블릿) 계정을 통합 관리하며 접속 상태를 실시간 관제합니다.
// ==========================================
function SupervisorView({ stores, setStores, activeSessions, logout, showAlert, showConfirm }) {
  const [activeTab, setActiveTab] = useState('manage'); 
  
  // 모달 폼 제어를 위한 상태 (null이면 폼 닫힘, 객체면 해당 정보로 폼 열림)
  const [storeForm, setStoreForm] = useState(null); 
  const [roomForm, setRoomForm] = useState(null); 

  const safeStores = stores || {};

  // 새 매장 등록 및 기존 매장 수정 처리
  const handleStoreSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const adminId = storeForm.mode === 'add' ? fd.get('adminId') : storeForm.adminId;
    
    // 신규 추가 시 ID 중복 방지
    if (storeForm.mode === 'add' && safeStores[adminId]) {
      await showAlert('오류', '이미 존재하는 매장 ID입니다.');
      return;
    }

    setStores(prev => {
      const safePrev = prev || {};
      const currentStore = safePrev[adminId] || {};
      return {
        ...safePrev,
        [adminId]: {
          ...currentStore, // 수정 시에는 기존의 데이터(메뉴, 주문 등)를 그대로 유지합니다.
          password: fd.get('password'),
          storeName: fd.get('storeName'),
          rooms: currentStore.rooms || [],
          menuItems: currentStore.menuItems || [],
          orders: currentStore.orders || [],
          calls: currentStore.calls || []
        }
      };
    });
    setStoreForm(null); // 모달 닫기
  };

  // 매장 완전 삭제
  const deleteStore = async (adminId) => {
    if(await showConfirm('매장 삭제', '이 매장과 소속된 모든 룸, 주문 데이터를 영구히 삭제하시겠습니까?')) {
      setStores(prev => {
        const copy = {...(prev || {})};
        delete copy[adminId]; // 객체에서 해당 매장 키를 완전히 지웁니다.
        return copy;
      });
    }
  };

  // 룸 계정 신규 발급 및 수정
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const loginId = fd.get('loginId');
    const adminId = roomForm.adminId;

    const currentStore = safeStores[adminId] || {};
    const storeRooms = currentStore.rooms || [];

    // 같은 매장 내에서 태블릿 접속 로그인 ID 중복 방지
    const isDuplicate = storeRooms.some(r => r.loginId === loginId && r.id !== roomForm.roomId);
    if (isDuplicate) {
      await showAlert('오류', '이 매장 내에 이미 존재하는 룸 ID입니다.');
      return;
    }

    setStores(prev => {
      const safePrev = prev || {};
      const targetStore = safePrev[adminId] || {};
      const rooms = targetStore.rooms || [];
      let newRooms;
      if (roomForm.mode === 'add') {
        newRooms = [...rooms, { id: 'room_' + Date.now(), name: fd.get('name'), loginId, password: fd.get('password') }];
      } else {
        newRooms = rooms.map(r => r.id === roomForm.roomId ? { ...r, name: fd.get('name'), loginId, password: fd.get('password') } : r);
      }
      return { ...safePrev, [adminId]: { ...targetStore, rooms: newRooms } };
    });
    setRoomForm(null);
  };

  // 특정 룸 삭제 처리
  const deleteRoom = async (adminId, roomId) => {
    if(await showConfirm('룸 삭제', '이 룸의 접속 계정을 영구히 삭제하시겠습니까?')) {
      setStores(prev => {
        const safePrev = prev || {};
        const targetStore = safePrev[adminId] || {};
        const rooms = targetStore.rooms || [];
        return {
          ...safePrev,
          [adminId]: { ...targetStore, rooms: rooms.filter(r => r.id !== roomId) }
        };
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* 좌측 네비게이션 사이드바 */}
      <div className="w-64 bg-indigo-950 text-white flex flex-col">
        <div className="p-6 text-lg font-black border-b border-indigo-900 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-indigo-400" />
          슈퍼바이저 시스템
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarBtn icon={<Store />} label="매장 및 계정 관리" active={activeTab === 'manage'} onClick={() => setActiveTab('manage')} />
          <SidebarBtn icon={<Activity />} label="시스템 관제 (모니터링)" active={activeTab === 'monitor'} onClick={() => setActiveTab('monitor')} />
        </nav>
        <div className="p-4 border-t border-indigo-900">
          <button onClick={logout} className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 rounded-lg font-medium transition flex justify-center items-center gap-2">
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </div>

      {/* 우측 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white shadow-sm p-5 flex justify-between items-center z-10">
          <h1 className="text-xl font-bold text-gray-800">
            {activeTab === 'manage' ? '전체 매장 및 룸(태블릿) 관리' : '실시간 접속 현황 관제'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {/* 매장 및 계정 관리 탭 */}
          {activeTab === 'manage' && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-gray-500">시스템을 이용할 매장을 등록하고 태블릿 계정을 발급합니다.</p>
                <button onClick={() => setStoreForm({mode: 'add'})} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-indigo-700 font-bold shadow-sm">
                  <Plus className="w-5 h-5" /> 새 매장 등록
                </button>
              </div>

              {/* 각 매장별 카드 렌더링 */}
              {Object.entries(safeStores).map(([adminId, store]) => {
                const safeStore = store || {};
                const storeRooms = safeStore.rooms || [];
                const storeName = safeStore.storeName || '알 수 없는 매장';
                const password = safeStore.password || '';

                return (
                  <div key={adminId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* 매장 헤더 (매장명, 관리자 계정정보, 버튼들) */}
                    <div className="bg-gray-50 p-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-black text-gray-900">{storeName}</h3>
                        </div>
                        <div className="flex gap-4 text-sm text-gray-600 bg-white inline-flex px-3 py-1.5 rounded border border-gray-200">
                          <span className="flex items-center gap-1"><User className="w-4 h-4"/> <b>ID:</b> {adminId}</span>
                          <div className="w-px bg-gray-300"></div>
                          <span className="flex items-center gap-1"><Key className="w-4 h-4"/> <b>PW:</b> {password}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setRoomForm({mode:'add', adminId})} className="bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50 font-bold text-sm flex items-center gap-1">
                          <Smartphone className="w-4 h-4"/> 룸 추가발급
                        </button>
                        <button onClick={() => setStoreForm({mode:'edit', adminId, ...safeStore})} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"><Edit className="w-4 h-4"/></button>
                        <button onClick={() => deleteStore(adminId)} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>

                    {/* 해당 매장에 소속된 룸(태블릿) 리스트 */}
                    <div className="p-5 bg-white">
                      <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2"><Smartphone className="w-4 h-4"/> 할당된 룸(태블릿) 목록</h4>
                      {storeRooms.length === 0 ? (
                        <div className="text-sm text-gray-400 py-2">등록된 룸이 없습니다.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {storeRooms.map(room => (
                            <div key={room.id} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:border-indigo-300 transition-colors">
                              <div>
                                <div className="font-bold text-gray-800 mb-1">{room.name}</div>
                                <div className="text-xs text-gray-500 flex gap-2">
                                  <span>ID: {room.loginId}</span> / <span>PW: {room.password}</span>
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <button onClick={() => setRoomForm({mode:'edit', adminId, roomId:room.id, ...room})} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit className="w-4 h-4"/></button>
                                <button onClick={() => deleteRoom(adminId, room.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 모니터링 (실시간 접속 관제) 탭 */}
          {activeTab === 'monitor' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl mb-6 flex items-center gap-3">
                <Server className="w-6 h-6 text-indigo-600" />
                <p className="text-indigo-900 font-medium">여러 브라우저 탭에서 각 계정으로 접속하여 <b>🟢 온라인 상태</b>가 실시간으로 변하는 것을 확인해 보세요.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(safeStores).map(([adminId, store]) => {
                  const safeStore = store || {};
                  const storeName = safeStore.storeName || '알 수 없는 매장';
                  const storeRooms = safeStore.rooms || [];
                  
                  // 해당 매장 관리자(PC)가 접속해 있는지 Firebase 세션으로 확인합니다.
                  const isAdminOnline = activeSessions[`admin_${adminId}`];
                  
                  return (
                    <div key={adminId} className={`bg-white rounded-2xl border-2 transition-colors overflow-hidden ${isAdminOnline ? 'border-indigo-400 shadow-md' : 'border-gray-200'}`}>
                      <div className={`p-4 flex items-center justify-between border-b ${isAdminOnline ? 'bg-indigo-50/50 border-indigo-100' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          <StatusIndicator online={isAdminOnline} />
                          <div>
                            <div className="font-black text-gray-900">{storeName}</div>
                            <div className="text-xs text-gray-500">관리자 PC</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 grid grid-cols-2 gap-3">
                        {/* 해당 매장의 각 룸(태블릿)들이 접속해 있는지 확인하여 상태 아이콘을 띄워줍니다. */}
                        {storeRooms.map(room => {
                          const isTabletOnline = activeSessions[`tablet_${adminId}_${room.id}`];
                          return (
                            <div key={room.id} className={`flex items-center gap-2 p-3 rounded-xl border ${isTabletOnline ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
                              <StatusIndicator online={isTabletOnline} small />
                              <div className="font-bold text-sm text-gray-700">{room.name}</div>
                            </div>
                          );
                        })}
                        {storeRooms.length === 0 && <div className="col-span-2 text-xs text-gray-400 py-2">룸이 없습니다.</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 모달 폼: 매장 신규 등록 / 정보 수정 */}
      {storeForm && (
        <ModalWrapper title={storeForm.mode === 'add' ? '새 매장 등록' : '매장 정보 수정'} onClose={() => setStoreForm(null)}>
          <form onSubmit={handleStoreSubmit} className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">매장명 (표시용)</label><input required name="storeName" defaultValue={storeForm.storeName} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="예: 룸오더 1호점" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">관리자 접속 ID</label><input required name="adminId" defaultValue={storeForm.adminId} readOnly={storeForm.mode === 'edit'} className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${storeForm.mode === 'edit' ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-indigo-500'}`} placeholder="영문/숫자 고유 ID" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">접속 비밀번호</label><input required name="password" defaultValue={storeForm.password} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="비밀번호 설정" /></div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setStoreForm(null)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">취소</button>
              <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">저장</button>
            </div>
          </form>
        </ModalWrapper>
      )}

      {/* 모달 폼: 태블릿 룸 계정 발급 / 수정 */}
      {roomForm && (
        <ModalWrapper title={roomForm.mode === 'add' ? '룸 계정 발급' : '룸 계정 수정'} onClose={() => setRoomForm(null)}>
          <form onSubmit={handleRoomSubmit} className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">룸 표시 이름</label><input required name="name" defaultValue={roomForm.name} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="예: 4번 방, VIP룸" /></div>
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
              <p className="text-xs font-bold text-indigo-800">태블릿 접속용 계정</p>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">접속 ID</label><input required name="loginId" defaultValue={roomForm.loginId} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="해당 매장 내에서 고유한 ID" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">비밀번호</label><input required name="password" defaultValue={roomForm.password} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button type="button" onClick={() => setRoomForm(null)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">취소</button>
              <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">저장</button>
            </div>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}

// 온라인 상태 표시용 작은 동그라미 불빛 아이콘 컴포넌트
function StatusIndicator({ online, small }) {
  if (online) return (
    <div className="relative flex items-center justify-center">
      {/* online이 true면 녹색 불빛이 깜빡(핑)이도록 효과 부여 */}
      <div className={`absolute bg-green-400 rounded-full animate-ping opacity-75 ${small ? 'w-3 h-3' : 'w-4 h-4'}`}></div>
      <div className={`relative bg-green-500 rounded-full ${small ? 'w-2 h-2' : 'w-3 h-3'}`}></div>
    </div>
  );
  // 오프라인이면 회색 원
  return <div className={`bg-gray-300 rounded-full ${small ? 'w-2 h-2' : 'w-3 h-3'}`}></div>;
}

// 폼 입력 모달을 띄울 때 배경을 반투명하게 덮어주는 재사용 래퍼 컴포넌트
function ModalWrapper({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-in-up">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-black text-gray-900">{title}</h3><button onClick={onClose} className="bg-gray-100 p-2 rounded-full hover:bg-gray-200"><X className="w-5 h-5"/></button></div>
        {children}
      </div>
    </div>
  );
}

// ==========================================
// 매장 관리자 뷰 (Admin PC용)
// 소속된 매장의 메뉴를 관리하고, 태블릿에서 날아오는 주문/호출을 처리합니다.
// ==========================================
function AdminView({ adminId, storeData, updateStore, getRoomName, logout, showAlert, showConfirm }) {
  // 현재 보고 있는 탭 (주문현황 / 메뉴관리 / 룸퇴실관리)
  const [activeTab, setActiveTab] = useState('orders'); 
  const [popups, setPopups] = useState([]); // 우측 상단에 띄울 주문/호출 푸시 알림 박스들
  
  // 파이어베이스에서 넘어온 데이터가 혹여나 없더라도 앱이 죽지 않도록(백화현상 방지) 기본 배열([])을 보장합니다.
  const safeStoreData = storeData || {};
  const orders = safeStoreData.orders || [];
  const calls = safeStoreData.calls || [];
  const menuItems = safeStoreData.menuItems || [];
  const rooms = safeStoreData.rooms || [];
  const storeName = safeStoreData.storeName || '알 수 없는 매장';

  // 알림 중복 방지를 위해 이미 한 번 알림을 띄운 주문과 호출의 ID를 기억해둡니다.
  const knownOrderIds = useRef(new Set(orders.map(o => o.id)));
  const knownCallIds = useRef(new Set(calls.map(c => c.id)));

  // 브라우저 내장 오디오 API를 사용하여 태블릿에서 주문/호출이 오면 '띵동' 소리를 냅니다.
  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  };

  // 새로운 주문이나 호출 데이터가 파이어베이스로부터 도착할 때마다 감지하여 알림 팝업과 소리를 발생시킵니다.
  useEffect(() => {
    // 아직 내가 알림을 받지 않은(knownSet에 없는) 'pending(대기)' 상태의 새로운 주문과 호출만 골라냅니다.
    const newOrders = orders.filter(o => o.status === 'pending' && !knownOrderIds.current.has(o.id));
    const newCalls = calls.filter(c => c.status === 'pending' && !knownCallIds.current.has(c.id));
    
    let shouldAlert = false;
    newOrders.forEach(o => {
      knownOrderIds.current.add(o.id);
      setPopups(p => [...p, { id: 'pop_'+Date.now()+Math.random(), type: 'order', refId: o.id, message: `[${getRoomName(o.roomId)}] 신규 주문이 들어왔습니다!` }]);
      shouldAlert = true;
    });
    newCalls.forEach(c => {
      knownCallIds.current.add(c.id);
      setPopups(p => [...p, { id: 'pop_'+Date.now()+Math.random(), type: 'call', refId: c.id, message: `[${getRoomName(c.roomId)}]에서 직원을 호출했습니다!` }]);
      shouldAlert = true;
    });

    // 새로운 건이 1건이라도 있으면 소리를 재생
    if (shouldAlert) playSound();
  }, [orders, calls]);

  // 특정 주문을 '처리 완료' 상태로 만듭니다. (팝업도 자동 삭제)
  const completeOrder = (id) => {
    updateStore(adminId, 'orders', prev => prev.map(o => o.id === id ? { ...o, status: 'completed' } : o));
    setPopups(prev => prev.filter(p => p.refId !== id));
  };

  // 특정 직원 호출을 '확인 완료' 상태로 만듭니다.
  const resolveCall = (id) => {
    updateStore(adminId, 'calls', prev => prev.map(c => c.id === id ? { ...c, status: 'resolved' } : c));
    setPopups(prev => prev.filter(p => p.refId !== id));
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* 관리자 좌측 네비게이션 메뉴 */}
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 text-xl font-black border-b border-slate-800 flex items-center gap-2">
          <MonitorPlay className="w-6 h-6 text-blue-400" /> 매장 관리
        </div>
        <div className="p-4 bg-slate-800/50 flex flex-col gap-1">
          <span className="text-xs text-slate-400">현재 매장</span>
          <span className="font-bold text-blue-300">{storeName}</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <SidebarBtn icon={<ShoppingCart />} label="주문/호출 현황" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} badge={orders.filter(o=>o.status==='pending').length + calls.filter(c=>c.status==='pending').length} />
          <SidebarBtn icon={<UtensilsCrossed />} label="메뉴 관리" active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} />
          <SidebarBtn icon={<Home />} label="룸 현황 및 퇴실관리" active={activeTab === 'rooms'} onClick={() => setActiveTab('rooms')} />
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={logout} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-medium transition flex justify-center items-center gap-2">
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </div>

      {/* 탭에 따라 메인 컴포넌트 교체 표시 */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white shadow-sm p-5 flex justify-between items-center z-10">
          <h1 className="text-xl font-bold text-gray-800">
            {activeTab === 'orders' && '주문 및 호출 현황'}
            {activeTab === 'menu' && '콘텐츠 관리 (메뉴)'}
            {activeTab === 'rooms' && '룸 현황 및 퇴실(초기화) 관리'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'orders' && <AdminOrders orders={orders} calls={calls} rooms={rooms} completeOrder={completeOrder} resolveCall={resolveCall} getRoomName={getRoomName} adminId={adminId} updateStore={updateStore} showConfirm={showConfirm} />}
          {activeTab === 'menu' && <AdminMenu menuItems={menuItems} adminId={adminId} updateStore={updateStore} showConfirm={showConfirm} />}
          {activeTab === 'rooms' && <AdminRoomsReadOnly rooms={rooms} adminId={adminId} updateStore={updateStore} showAlert={showAlert} showConfirm={showConfirm} />}
        </main>

        {/* 새 알림 발생 시 우측 상단에 쌓이는 푸시 알림 UI */}
        <div className="absolute top-6 right-6 flex flex-col gap-3 z-50">
          {popups.map(popup => (
            <div key={popup.id} className={`text-white px-6 py-4 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[300px] animate-bounce ${popup.type === 'call' ? 'bg-red-600' : 'bg-blue-600'}`}>
              <div className="flex items-center gap-3"><AlertCircle className="w-6 h-6 flex-shrink-0" /><span className="font-medium text-lg">{popup.message}</span></div>
              <div className="flex justify-end gap-2">
                {/* 팝업 안에서도 즉시 처리 버튼 제공 */}
                {popup.type === 'call' && <button onClick={() => resolveCall(popup.refId)} className="bg-white text-red-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-red-50">호출 확인</button>}
                {popup.type === 'order' && <button onClick={() => completeOrder(popup.refId)} className="bg-white text-blue-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-blue-50">주문 처리완료</button>}
                <button onClick={() => setPopups(p => p.filter(x => x.id !== popup.id))} className="bg-black/20 hover:bg-black/30 px-3 py-1.5 rounded-lg text-sm text-white">닫기</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 룸 퇴실(데이터 리셋) 전용 컴포넌트
function AdminRoomsReadOnly({ rooms, adminId, updateStore, showAlert, showConfirm }) {
  const handleCheckout = async (roomName, roomId) => {
    if(await showConfirm('퇴실 및 초기화', `[${roomName}]의 손님이 퇴실하셨나요?\n확인을 누르면 해당 방의 모든 주문 명세와 호출 내역이 초기화됩니다.`)) {
      // 해당 룸과 관련된 주문, 호출 기록을 필터로 걸러내서 완벽히 제거합니다.
      updateStore(adminId, 'orders', prev => prev.filter(o => o.roomId !== roomId));
      updateStore(adminId, 'calls', prev => prev.filter(c => c.roomId !== roomId));
      await showAlert('초기화 완료', `${roomName}의 주문 및 호출 내역이 초기화되었습니다.`);
    }
  };

  return (
    <div className="max-w-4xl bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
        <div><h2 className="text-xl font-black text-gray-800">운영 중인 룸 목록</h2><p className="text-sm text-gray-500 mt-1">손님 퇴실 시 내역을 초기화 할 수 있습니다. 룸 추가/발급은 슈퍼바이저에게 문의하세요.</p></div>
      </div>
      <div className="space-y-4">
        {rooms.length === 0 ? <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-lg">할당된 룸이 없습니다. 슈퍼바이저에게 문의하세요.</div> : (
          rooms.map(room => (
            <div key={room.id} className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-5 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white transition-colors gap-4">
              <div className="flex items-center gap-4"><div className="bg-blue-100 p-3 rounded-xl text-blue-600"><Home className="w-6 h-6" /></div><div className="font-black text-gray-900 text-xl">{room.name}</div></div>
              <button onClick={() => handleCheckout(room.name, room.id)} className="w-full lg:w-auto flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-900 font-bold transition-colors shadow-md">
                <RotateCcw className="w-5 h-5" /> 퇴실 처리 (주문/호출 초기화)
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// 사이드바 버튼 반복 렌더링용 유틸 컴포넌트
function SidebarBtn({ icon, label, active, onClick, badge }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`}>
      <div className="flex items-center gap-3">{React.cloneElement(icon, { className: "w-5 h-5" })}<span>{label}</span></div>
      {badge > 0 && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{badge}</span>}
    </button>
  );
}

// 주문/호출 대시보드 컴포넌트 (특정 룸 필터링 기능 포함)
function AdminOrders({ orders, calls, rooms, completeOrder, resolveCall, getRoomName, adminId, updateStore, showConfirm }) {
  // 전체보기 또는 특정 룸만 보기 위한 필터 상태값
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('all');
  
  // 아직 처리되지 않은 호출만 걸러냄
  const pendingCalls = calls.filter(c => c.status === 'pending');
  // 필터값에 맞춰 보여줄 주문 목록 필터링 (전체 혹은 선택한 방)
  const filteredOrders = orders.filter(o => selectedRoomFilter === 'all' || o.roomId === selectedRoomFilter);

  // 특정 주문 1건 삭제
  const deleteOrder = async (id) => {
    if(await showConfirm('주문 삭제', '주문 내역을 영구 삭제하시겠습니까?')) updateStore(adminId, 'orders', prev => prev.filter(o => o.id !== id));
  };

  // 현재 필터된 룸의 주문을 한꺼번에 비워버리는 기능 (일괄 삭제)
  const deleteAllOrders = async () => {
    const msg = selectedRoomFilter === 'all' 
      ? '전체 주문 내역을 일괄 영구 삭제하시겠습니까?' 
      : `[${getRoomName(selectedRoomFilter)}]의 모든 주문 내역을 삭제하시겠습니까?`;
      
    if (await showConfirm('주문 일괄 삭제', msg)) {
      updateStore(adminId, 'orders', prev => {
        if (selectedRoomFilter === 'all') return []; // 전체삭제면 텅 빈 배열로 바꿈
        return prev.filter(o => o.roomId !== selectedRoomFilter); // 특정 방이면 그 방의 데이터만 제거
      });
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* 호출 리스트 (직원 호출이 들어왔을 때만 상단에 표시됩니다) */}
      {pendingCalls.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-red-700 font-bold text-lg mb-4 flex items-center gap-2"><Bell className="w-5 h-5" /> 진행 중인 직원 호출</h2>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[...pendingCalls].reverse().map(call => (
              <div key={call.id} className="bg-white p-4 rounded-lg shadow-sm border border-red-100 flex justify-between items-center ring-2 ring-red-400 ring-offset-1">
                <div><div className="font-bold text-lg text-gray-800">{getRoomName(call.roomId)}</div><div className="text-xs text-gray-500">{new Date(call.timestamp).toLocaleTimeString()}</div></div>
                <button onClick={() => resolveCall(call.id)} className="bg-red-500 text-white px-4 py-2 rounded font-bold hover:bg-red-600 transition-colors">확인 완료</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 주문 리스트 및 필터 컨트롤 영역 */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-gray-700 font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> 주문 내역
          </h2>
          
          {/* 룸별 필터링 드롭다운 메뉴 및 일괄삭제 버튼 */}
          <div className="flex items-center gap-2">
            <select
              value={selectedRoomFilter}
              onChange={(e) => setSelectedRoomFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-700 bg-white"
            >
              <option value="all">전체 룸 보기</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            
            {filteredOrders.length > 0 && (
              <button
                onClick={deleteAllOrders}
                className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg font-bold text-sm hover:bg-red-100 flex items-center gap-1 shadow-sm transition-colors"
              >
                <Trash2 className="w-4 h-4" /> 일괄 삭제
              </button>
            )}
          </div>
        </div>

        {/* 필터 결과에 따라 화면 렌더링 */}
        {filteredOrders.length === 0 ? <div className="text-gray-500 py-10 text-center bg-white rounded-xl border border-dashed border-gray-300">표시할 주문이 없습니다.</div> : (
          <div className="grid gap-4">
            {[...filteredOrders].reverse().map(order => (
              <div key={order.id} className={`bg-white p-5 rounded-xl border-l-4 shadow-sm flex flex-col md:flex-row justify-between gap-4 transition-all ${order.status === 'pending' ? 'border-blue-500 ring-1 ring-blue-100' : 'border-green-500 opacity-70'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-black text-gray-800">{getRoomName(order.roomId)}</span>
                    <span className="text-sm text-gray-500">{new Date(order.timestamp).toLocaleTimeString()}</span>
                    {order.status === 'pending' ? <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold">신규 주문</span> : <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-bold">처리 완료</span>}
                  </div>
                  <ul className="text-gray-600 space-y-1 mb-3 bg-gray-50 p-3 rounded-lg">
                    {order.items.map((item, idx) => <li key={idx} className="flex justify-between max-w-sm"><span>{item.name}</span><span className="font-medium text-gray-900">{item.quantity}개</span></li>)}
                  </ul>
                  <div className="font-bold text-lg text-gray-900">결제(예정) 금액 : <span className="text-blue-600">{order.total.toLocaleString()}원</span></div>
                </div>
                <div className="flex items-center gap-2">
                  {order.status === 'pending' && <button onClick={() => completeOrder(order.id)} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"><Check className="w-5 h-5" /> 처리완료</button>}
                  <button onClick={() => deleteOrder(order.id)} className="bg-gray-100 text-gray-500 px-4 py-3 rounded-lg hover:bg-gray-200 hover:text-red-600"><Trash2 className="w-5 h-5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 메뉴(상품) 관리 (추가/수정/삭제) 컴포넌트
function AdminMenu({ menuItems, adminId, updateStore, showConfirm }) {
  const [editingItem, setEditingItem] = useState(null); // 수정 중인 객체를 담아 모달에 전달

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newItem = { id: editingItem.id || 'm_' + Date.now(), name: formData.get('name'), price: parseInt(formData.get('price'), 10), description: formData.get('description'), category: formData.get('category'), image: formData.get('image') || 'https://via.placeholder.com/200?text=No+Image' };
    
    // id가 있으면(수정 상태면) 기존 요소를 찾아 교체하고, 없으면 신규 배열 요소로 추가
    updateStore(adminId, 'menuItems', prev => editingItem.id ? prev.map(m => m.id === newItem.id ? newItem : m) : [...prev, newItem]);
    setEditingItem(null); // 모달 닫기
  };

  const deleteItem = async (id) => {
    if(await showConfirm('메뉴 삭제', '이 메뉴를 영구히 삭제하시겠습니까?')) updateStore(adminId, 'menuItems', prev => prev.filter(m => m.id !== id));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-700">판매 메뉴 목록</h2>
        <button onClick={() => setEditingItem({})} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm"><Plus className="w-4 h-4" /> 메뉴 추가</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {menuItems.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col">
            <img src={item.image} alt={item.name} className="w-full h-40 object-cover bg-gray-100" onError={(e)=>{e.target.src='https://via.placeholder.com/200?text=Image+Error'}} />
            <div className="p-4 flex-1 flex flex-col">
              <div className="text-xs text-blue-600 font-bold mb-1">{item.category}</div>
              <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
              <div className="text-gray-500 text-sm flex-1 mt-1 mb-2 line-clamp-2">{item.description}</div>
              <div className="font-black text-lg text-gray-900">{item.price.toLocaleString()}원</div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                <button onClick={() => setEditingItem(item)} className="flex-1 bg-gray-50 text-gray-600 py-2 rounded-lg hover:bg-gray-100 flex justify-center items-center gap-1 text-sm font-medium"><Edit className="w-4 h-4" /> 수정</button>
                <button onClick={() => deleteItem(item.id)} className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 flex justify-center items-center gap-1 text-sm font-medium"><Trash2 className="w-4 h-4" /> 삭제</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 메뉴 작성/수정 모달창 */}
      {editingItem && (
        <ModalWrapper title={editingItem.id ? '메뉴 수정' : '새 메뉴 추가'} onClose={() => setEditingItem(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">카테고리</label><input required name="category" defaultValue={editingItem.category} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="예: 음료, 식사" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">메뉴명</label><input required name="name" defaultValue={editingItem.name} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="예: 아이스 아메리카노" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">가격 (원)</label><input required type="number" name="price" defaultValue={editingItem.price} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">설명</label><textarea required name="description" defaultValue={editingItem.description} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" rows="2"></textarea></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">사진 URL (선택)</label><input name="image" defaultValue={editingItem.image} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." /></div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg hover:bg-blue-700 mt-6 shadow-md">저장하기</button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}

// ==========================================
// 사용자 뷰 (태블릿 전용)
// 방 손님이 메뉴를 선택하고, 주문 전송 및 직원 호출을 합니다.
// ==========================================
function TabletView({ adminId, storeData, roomId, updateStore, logout, showAlert }) {
  // 태블릿 로컬 상태 (장바구니와 카테고리 필터)
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [showHistoryModal, setShowHistoryModal] = useState(false); // 주문 명세서 창 상태
  
  // 파이어베이스에서 넘겨받은 매장 전역 데이터를 안전하게 초기화합니다.
  const safeStoreData = storeData || {};
  const menuItems = safeStoreData.menuItems || [];
  const orders = safeStoreData.orders || [];
  const rooms = safeStoreData.rooms || [];
  const storeName = safeStoreData.storeName || '알 수 없는 매장';

  const currentRoom = rooms.find(r => r.id === roomId);
  const categories = ['전체', ...new Set(menuItems.map(m => m.category))]; // 전체보기 탭 포함
  const filteredMenu = activeCategory === '전체' ? menuItems : menuItems.filter(m => m.category === activeCategory);

  const cartTotal = cart.reduce((sum, cartItem) => sum + (cartItem.item.price * cartItem.quantity), 0);
  
  // 현재 접속 중인 룸이 지금까지 시킨 모든 주문 내역
  const myOrders = orders.filter(o => o.roomId === roomId);
  const totalOrderedAmount = myOrders.reduce((sum, order) => sum + order.total, 0);

  // 장바구니 추가 로직
  const addToCart = (item) => {
    const existing = cart.find(c => c.item.id === item.id);
    // 이미 담긴 상품이면 수량만 1 증가
    if (existing) setCart(cart.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    else setCart([...cart, { item, quantity: 1 }]);
  };

  // 장바구니 수량 조절. 수량이 0이 되면 항목에서 제거합니다.
  const updateQuantity = (id, delta) => setCart(cart.map(c => c.item.id === id ? (c.quantity + delta > 0 ? { ...c, quantity: c.quantity + delta } : null) : c).filter(Boolean));

  // 주문 접수 (Firestore 통신)
  const placeOrder = async () => {
    if (cart.length === 0) return;
    const newOrder = { id: 'ord_' + Date.now() + Math.random(), roomId, items: cart.map(c => ({ name: c.item.name, quantity: c.quantity, price: c.item.price })), total: cartTotal, status: 'pending', timestamp: Date.now() };
    
    // DB의 주문 배열에 덧붙입니다.
    updateStore(adminId, 'orders', prev => [...prev, newOrder]);
    setCart([]); // 주문 완료 후 장바구니 비우기
    await showAlert('주문 접수', '주문이 접수되었습니다. 잠시만 기다려주세요.');
  };

  // 관리자(직원) 호출 (Firestore 통신)
  const callAdmin = async () => {
    const newCall = { id: 'call_' + Date.now() + Math.random(), roomId, status: 'pending', timestamp: Date.now() };
    updateStore(adminId, 'calls', prev => [...prev, newCall]);
    await showAlert('호출 완료', '직원을 호출했습니다. 잠시만 기다려주세요.');
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-800 font-sans overflow-hidden">
      {/* 상단 기기 정보 바 (데모용) */}
      <div className="absolute top-0 left-0 right-0 bg-slate-900 text-white p-3 flex justify-between items-center z-50 shadow-md">
        <div className="flex items-center gap-4 ml-2">
          <div className="flex items-center gap-2"><Store className="w-4 h-4 text-blue-400" /><span className="font-bold text-sm">{storeName}</span></div>
          <div className="w-px h-4 bg-slate-700"></div>
          <div className="flex items-center gap-2 text-blue-300 bg-slate-800 px-3 py-1 rounded-full"><Home className="w-4 h-4" /><span className="font-bold text-sm">{currentRoom?.name || '알 수 없음'}</span></div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white"><LogOut className="w-4 h-4" /> 기기 로그아웃</button>
      </div>

      <div className="flex w-full h-full pt-[52px]">
        {/* 화면 왼쪽: 메인 메뉴 선택 영역 */}
        <div className="flex-1 flex flex-col h-full bg-white relative">
          <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-end">
            <div><p className="text-blue-600 font-black mb-1">{currentRoom?.name} 전용 태블릿</p><h1 className="text-3xl md:text-4xl font-black text-gray-900">ROOM SERVICE</h1></div>
            <div className="flex gap-3">
              <button onClick={() => setShowHistoryModal(true)} className="bg-gray-100 text-gray-700 px-5 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-200 active:scale-95"><FileText className="w-6 h-6" /> 주문 내역</button>
              <button onClick={callAdmin} className="bg-red-50 text-red-600 border border-red-200 px-5 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-100 active:scale-95"><Bell className="w-6 h-6" /> 직원 호출</button>
            </div>
          </div>
          <div className="flex gap-2 p-6 md:px-8 overflow-x-auto hide-scrollbar border-b border-gray-50 bg-white">
            {categories.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 py-3 rounded-full font-bold whitespace-nowrap transition-colors border shadow-sm ${activeCategory === cat ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{cat}</button>)}
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F8F9FA]">
            {filteredMenu.length === 0 ? <div className="text-center py-20 text-gray-400 font-medium">관리자가 등록한 메뉴가 없습니다.</div> : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredMenu.map(item => (
                  <div key={item.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col active:scale-[0.98] transition-transform cursor-pointer group hover:shadow-md" onClick={() => addToCart(item)}>
                    <div className="h-48 bg-gray-200 relative overflow-hidden"><img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" /><div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div></div>
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div><h3 className="font-bold text-xl text-gray-900 mb-1">{item.name}</h3><p className="text-gray-500 text-sm line-clamp-2">{item.description}</p></div>
                      <div className="mt-4 flex justify-between items-center"><span className="font-black text-lg text-blue-600">{item.price.toLocaleString()}원</span><div className="bg-black text-white p-2.5 rounded-full group-hover:bg-blue-600"><Plus className="w-5 h-5" /></div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 스크롤 시 시각적 매끄러움을 위한 하단 그라데이션 장식 */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-gray-100 to-transparent pointer-events-none"></div>
        </div>

        {/* 화면 오른쪽: 장바구니(결제) 영역 */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-[-10px_0_20px_rgba(0,0,0,0.02)] z-10">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3"><ShoppingCart className="w-6 h-6 text-gray-800" /><h2 className="text-xl font-bold text-gray-900">새 주문 담기</h2><span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold">{cart.reduce((a, b) => a + b.quantity, 0)}개</span></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
            {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3"><Coffee className="w-16 h-16 opacity-20" /><p className="font-medium">좌측에서 메뉴를 선택해 주세요</p></div> : (
              cart.map(c => (
                <div key={c.item.id} className="flex flex-col bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between font-bold text-gray-800 mb-3"><span className="text-lg">{c.item.name}</span><span className="text-blue-600">{(c.item.price * c.quantity).toLocaleString()}원</span></div>
                  <div className="flex justify-between items-center border-t border-gray-50 pt-3"><span className="text-gray-400 text-sm font-medium">단가 {c.item.price.toLocaleString()}원</span>
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                      <button onClick={() => updateQuantity(c.item.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600"><span className="text-xl leading-none font-medium mb-0.5">-</span></button>
                      <span className="font-black text-lg w-4 text-center">{c.quantity}</span>
                      <button onClick={() => updateQuantity(c.item.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-end mb-6"><span className="text-gray-500 font-bold">결제 예정 금액</span><span className="text-3xl font-black text-gray-900 tracking-tight">{cartTotal.toLocaleString()}원</span></div>
            <button onClick={placeOrder} disabled={cart.length === 0} className={`w-full py-5 rounded-2xl font-bold text-xl flex justify-center items-center gap-2 transition-all ${cart.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800 shadow-xl shadow-black/20 active:scale-[0.98]'}`}>주문하기</button>
            <p className="text-center text-sm text-gray-400 mt-4 font-medium">※ 결제는 퇴실 시 프론트에서 진행됩니다.</p>
          </div>
        </div>
      </div>

      {/* 태블릿용 과거 주문 내역 (영수증) 확인 모달 */}
      {showHistoryModal && (
        <ModalWrapper title="나의 주문 명세" onClose={() => setShowHistoryModal(false)}>
           <div className="max-h-[60vh] overflow-y-auto mb-6 pr-2">
              {myOrders.length === 0 ? <div className="text-center py-10 text-gray-400">주문 내역이 없습니다.</div> : (
                <div className="space-y-4">
                  {[...myOrders].reverse().map((order, idx) => (
                    <div key={order.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="font-bold text-gray-800 text-sm">주문 {myOrders.length - idx}</span>
                        {order.status === 'pending' ? <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">준비중</span> : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">전달완료</span>}
                      </div>
                      <ul className="space-y-1 text-sm text-gray-700">
                        {order.items.map((item, i) => <li key={i} className="flex justify-between"><span>{item.name} x {item.quantity}</span><span className="font-medium">{(item.price * item.quantity).toLocaleString()}원</span></li>)}
                      </ul>
                      <div className="text-right pt-2 border-t border-gray-200 font-black text-gray-900">합계: {order.total.toLocaleString()}원</div>
                    </div>
                  ))}
                </div>
              )}
           </div>
           <div className="bg-gray-100 -mx-6 -mb-6 p-6 rounded-b-2xl flex justify-between items-center">
              <span className="text-gray-500 font-bold">총 누적 결제금액</span>
              <span className="text-2xl font-black text-blue-600">{totalOrderedAmount.toLocaleString()}원</span>
           </div>
        </ModalWrapper>
      )}
    </div>
  );
}

// ==========================================
// 전역 커스텀 모달 (Global Modal)
// ==========================================
// 브라우저 네이티브인 alert, confirm, prompt를 사용하면 모바일 뷰어 등에서 차단되거나 로직이 멈추는 오류가 생깁니다.
// 이를 방지하기 위해 React 상태로 컨트롤되는 공통 디자인 모달 컴포넌트를 사용합니다.
function GlobalModal({ config }) {
  if (!config) return null;
  const [inputValue, setInputValue] = useState(config.defaultValue || '');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slide-in-up">
        <h3 className="text-xl font-black text-gray-900 mb-3">{config.title}</h3>
        <p className="text-gray-600 mb-6 whitespace-pre-wrap leading-relaxed">{config.message}</p>
        
        {config.type === 'prompt' && (
          <input 
            autoFocus 
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            className="w-full border border-gray-300 p-3 rounded-lg mb-6 focus:ring-2 focus:ring-blue-500 outline-none" 
            placeholder="입력해주세요"
          />
        )}
        
        <div className="flex justify-end gap-2">
          {config.type !== 'alert' && (
            <button 
              onClick={config.onCancel} 
              className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
          )}
          <button 
            onClick={() => config.onConfirm(inputValue)} 
            className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}