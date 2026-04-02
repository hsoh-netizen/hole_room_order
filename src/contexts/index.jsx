import { createContext, useContext, useState, useEffect } from 'react';
import { api, socketMock, globalDB } from '../api/mockBackend';

// ==========================================
// [Context & State Management]
// 상태 관리를 중앙화하여 Prop Drilling 방지
// ==========================================
const AuthContext = createContext(null);
const StoreContext = createContext(null);
const ModalContext = createContext(null);

function useModal() {
  return useContext(ModalContext);
}

// ==========================================
// [App Component (Provider 설정)]
// ==========================================

export default function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('room_order_session_v4');
    return saved ? JSON.parse(saved) : null;
  });
  const [modalConfig, setModalConfig] = useState(null);
  
  // 로그인 시 오디오 컨텍스트를 미리 생성
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (session) localStorage.setItem('room_order_session_v4', JSON.stringify(session));
    else localStorage.removeItem('room_order_session_v4');
  }, [session]);

  const handleLogin = async (role, id, pw) => {
    try {
      const result = await api.login(role, id, pw);
      // 사용자 Interaction(클릭) 내에서 AudioContext 초기화
      if (role === 'admin' && !audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      }
      setSession(result);
    } catch (err) {
      throw err; // 에러는 뷰에서 처리
    }
  };

  const handleLogout = () => setSession(null);

  const showModal = (type, title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      setModalConfig({
        type, title, message, defaultValue,
        onConfirm: (val) => { setModalConfig(null); resolve(type === 'prompt' ? val : true); },
        onCancel: () => { setModalConfig(null); resolve(type === 'prompt' ? null : false); }
      });
    });
  };

  const modalActions = {
    showAlert: (title, msg) => showModal('alert', title, msg),
    showConfirm: (title, msg) => showModal('confirm', title, msg),
    showPrompt: (title, msg, def) => showModal('prompt', title, msg, def)
  };

  return (
    <ModalContext.Provider value={modalActions}>
      <AuthContext.Provider value={{ session, login: handleLogin, logout: handleLogout, audioCtx: audioCtxRef.current }}>
        <StoreProvider session={session}>
          {!session ? <AuthView /> : (
            <>
              {session.role === 'supervisor' && <SupervisorView />}
              {session.role === 'admin' && <AdminView />}
              {session.role === 'tablet' && <TabletView />}
            </>
          )}
          {modalConfig && <GlobalModal config={modalConfig} />}
        </StoreProvider>
      </AuthContext.Provider>
    </ModalContext.Provider>
  );
}

// 실시간 데이터를 구독하는 Store Provider
function StoreProvider({ session, children }) {
  const [storeData, setStoreData] = useState(null);
  const [allStores, setAllStores] = useState(null);

  useEffect(() => {
    if (!session) return;
    
    if (session.role === 'supervisor') {
      setAllStores(globalDB);
      const handler = (data) => setAllStores({...data});
      socketMock.on('update_supervisor', handler);
      return () => socketMock.off('update_supervisor', handler);
    } else {
      setStoreData(globalDB[session.adminId] || null);
      const handler = (data) => setStoreData({...data});
      socketMock.on(`update_${session.adminId}`, handler);
      return () => socketMock.off(`update_${session.adminId}`, handler);
    }
  }, [session]);

  const value = { storeData, allStores };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}