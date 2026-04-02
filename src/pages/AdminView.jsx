import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import { MonitorPlay, ShoppingCart, UtensilsCrossed, Home, LogOut, AlertCircle, Bell, Trash2, Check, Edit, Plus, RotateCcw } from 'lucide-react';
import { AuthContext, StoreContext, useModal } from '../contexts';
import { api } from '../api/mockBackend';
import { LoadingScreen, ModalWrapper } from '../components';

// ==========================================
// 매장 관리자 뷰 (PC)
// ==========================================
function AdminView() {
  const { session, logout, audioCtx } = useContext(AuthContext);
  const { storeData } = useContext(StoreContext);
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState('orders');
  const [popups, setPopups] = useState([]);
  
  const adminId = session.adminId;
  const safeData = storeData || { orders: [], calls: [], menuItems: [], rooms: [] };
  const storeName = safeData.storeName || '매장 정보 로딩중...';

  const knownOrderIds = useRef(new Set(safeData.orders.map(o => o.id)));
  const knownCallIds = useRef(new Set(safeData.calls.map(c => c.id)));
  const audioIntervalRef = useRef(null);

  const getRoomName = (roomId) => safeData.rooms.find(r => r.id === roomId)?.name || '알 수 없는 룸';

  // 오디오 재생 로직 (AudioContext 재사용)
  const playSound = (type) => {
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      if (type === 'order') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.4);
      } else {
        osc.type = 'triangle'; osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + 0.5);
      }
    } catch (e) {}
  };

  const pendingOrders = useMemo(() => safeData.orders.filter(o => o.status === 'pending'), [safeData.orders]);
  const pendingCalls = useMemo(() => safeData.calls.filter(c => c.status === 'pending'), [safeData.calls]);

  useEffect(() => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    const hasOrders = pendingOrders.length > 0;
    const hasCalls = pendingCalls.length > 0;
    
    if (!hasOrders && !hasCalls) return;

    const triggerSound = () => {
      if (hasOrders) playSound('order');
      if (hasCalls) setTimeout(() => playSound('call'), hasOrders ? 500 : 0);
    };

    triggerSound();
    audioIntervalRef.current = setInterval(triggerSound, 2000);
    return () => clearInterval(audioIntervalRef.current);
  }, [pendingOrders.length, pendingCalls.length, audioCtx]);

  // 신규 팝업 띄우기
  useEffect(() => {
    const newOrders = pendingOrders.filter(o => !knownOrderIds.current.has(o.id));
    const newCalls = pendingCalls.filter(c => !knownCallIds.current.has(c.id));
    
    newOrders.forEach(o => {
      knownOrderIds.current.add(o.id);
      setPopups(p => [...p, { id: 'pop_'+o.id, type: 'order', refId: o.id, message: `[${getRoomName(o.roomId)}] 신규 주문!` }]);
    });
    newCalls.forEach(c => {
      knownCallIds.current.add(c.id);
      setPopups(p => [...p, { id: 'pop_'+c.id, type: 'call', refId: c.id, message: `[${getRoomName(c.roomId)}] 직원 호출!` }]);
    });
  }, [pendingOrders, pendingCalls]);

  const completeOrder = (id) => {
    api.completeOrder(adminId, id);
    setPopups(prev => prev.filter(p => p.refId !== id));
  };

  const resolveCall = (id) => {
    api.resolveCall(adminId, id);
    setPopups(prev => prev.filter(p => p.refId !== id));
  };

  if (!storeData) return <LoadingScreen />;

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <AdminSidebar activeTab={activeTab} setActiveTab={setActiveTab} storeName={storeName} logout={logout} pendingCount={pendingOrders.length + pendingCalls.length} />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white shadow-sm p-5 flex justify-between items-center z-10">
          <h1 className="text-xl font-bold text-gray-800">
            {activeTab === 'orders' && '주문 및 호출 현황'}
            {activeTab === 'menu' && '콘텐츠 관리 (메뉴)'}
            {activeTab === 'rooms' && '룸 현황 및 퇴실 관리'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'orders' && <AdminOrders orders={safeData.orders} calls={safeData.calls} rooms={safeData.rooms} completeOrder={completeOrder} resolveCall={resolveCall} getRoomName={getRoomName} adminId={adminId} />}
          {activeTab === 'menu' && <AdminMenu menuItems={safeData.menuItems} adminId={adminId} />}
          {activeTab === 'rooms' && <AdminRooms rooms={safeData.rooms} adminId={adminId} />}
        </main>

        {/* 팝업 컨테이너 */}
        <div className="absolute top-6 right-6 flex flex-col gap-3 z-50">
          {popups.map(popup => (
            <div key={popup.id} className={`text-white px-6 py-4 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[300px] animate-bounce ${popup.type === 'call' ? 'bg-red-600' : 'bg-blue-600'}`}>
              <div className="flex items-center gap-3"><AlertCircle className="w-6 h-6 flex-shrink-0" /><span className="font-medium text-lg">{popup.message}</span></div>
              <div className="flex justify-end gap-2">
                {popup.type === 'call' && <button onClick={() => resolveCall(popup.refId)} className="bg-white text-red-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-red-50">호출 확인</button>}
                {popup.type === 'order' && <button onClick={() => completeOrder(popup.refId)} className="bg-white text-blue-600 px-4 py-1.5 rounded-lg font-bold text-sm hover:bg-blue-50">처리 완료</button>}
                <button onClick={() => setPopups(p => p.filter(x => x.id !== popup.id))} className="bg-black/20 hover:bg-black/30 px-3 py-1.5 rounded-lg text-sm text-white">닫기</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminSidebar({ activeTab, setActiveTab, storeName, logout, pendingCount }) {
  return (
    <div className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 text-xl font-black border-b border-slate-800 flex items-center gap-2">
        <MonitorPlay className="w-6 h-6 text-blue-400" /> 매장 관리
      </div>
      <div className="p-4 bg-slate-800/50 flex flex-col gap-1">
        <span className="text-xs text-slate-400">현재 매장</span>
        <span className="font-bold text-blue-300">{storeName}</span>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <SidebarBtn icon={<ShoppingCart />} label="주문/호출 현황" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} badge={pendingCount} />
        <SidebarBtn icon={<UtensilsCrossed />} label="메뉴 관리" active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} />
        <SidebarBtn icon={<Home />} label="룸 현황 및 퇴실" active={activeTab === 'rooms'} onClick={() => setActiveTab('rooms')} />
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button onClick={logout} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-medium transition flex justify-center items-center gap-2">
          <LogOut className="w-4 h-4" /> 로그아웃
        </button>
      </div>
    </div>
  );
}

function AdminOrders({ orders, calls, rooms, completeOrder, resolveCall, getRoomName, adminId }) {
  const [selectedRoomFilter, setSelectedRoomFilter] = useState('all');
  const { showConfirm } = useModal();
  const pendingCalls = calls.filter(c => c.status === 'pending');
  const filteredOrders = orders.filter(o => selectedRoomFilter === 'all' || o.roomId === selectedRoomFilter);

  const deleteOrder = async (id) => {
    if (await showConfirm('주문 삭제', '주문 내역을 영구 삭제하시겠습니까?')) {
      api.adminUpdate(adminId, 'orders', orders.filter(o => o.id !== id));
    }
  };

  const deleteAllOrders = async () => {
    const msg = selectedRoomFilter === 'all' ? '전체 주문 내역을 일괄 영구 삭제하시겠습니까?' : `[${getRoomName(selectedRoomFilter)}]의 모든 주문 내역을 삭제하시겠습니까?`;
    if (await showConfirm('주문 일괄 삭제', msg)) {
      api.adminUpdate(adminId, 'orders', selectedRoomFilter === 'all' ? [] : orders.filter(o => o.roomId !== selectedRoomFilter));
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {pendingCalls.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-red-700 font-bold text-lg mb-4 flex items-center gap-2"><Bell className="w-5 h-5" /> 진행 중인 직원 호출</h2>
          {/* 배열 뒤집기는 CSS를 활용해 최적화 (배열을 복사하고 뒤집는 리소스 절약) */}
          <div className="flex flex-col-reverse gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
            {pendingCalls.map(call => (
              <div key={call.id} className="bg-white p-4 rounded-lg shadow-sm border border-red-100 flex justify-between items-center ring-2 ring-red-400 ring-offset-1">
                <div><div className="font-bold text-lg text-gray-800">{getRoomName(call.roomId)}</div><div className="text-xs text-gray-500">{new Date(call.timestamp).toLocaleTimeString()}</div></div>
                <button onClick={() => resolveCall(call.id)} className="bg-red-500 text-white px-4 py-2 rounded font-bold hover:bg-red-600 transition-colors">확인 완료</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-gray-700 font-bold text-lg flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> 주문 내역
          </h2>
          <div className="flex items-center gap-2">
            <select value={selectedRoomFilter} onChange={(e) => setSelectedRoomFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 text-sm font-bold text-gray-700 bg-white">
              <option value="all">전체 룸 보기</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {filteredOrders.length > 0 && (
              <button onClick={deleteAllOrders} className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg font-bold text-sm hover:bg-red-100 flex items-center gap-1 shadow-sm transition-colors">
                <Trash2 className="w-4 h-4" /> 일괄 삭제
              </button>
            )}
          </div>
        </div>

        {filteredOrders.length === 0 ? <div className="text-gray-500 py-10 text-center bg-white rounded-xl border border-dashed border-gray-300">표시할 주문이 없습니다.</div> : (
          <div className="flex flex-col-reverse gap-4">
            {filteredOrders.map(order => (
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
                  <div className="font-bold text-lg text-gray-900">결제금액: <span className="text-blue-600">{order.total.toLocaleString()}원</span></div>
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

function AdminMenu({ menuItems, adminId }) {
  const [editingItem, setEditingItem] = useState(null);
  const { showConfirm } = useModal();

  const handleSave = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newItem = { id: editingItem.id || 'm_' + Date.now(), name: fd.get('name'), price: parseInt(fd.get('price'), 10), description: fd.get('description'), category: fd.get('category') };
    api.adminUpdate(adminId, 'menuItems', editingItem.id ? menuItems.map(m => m.id === newItem.id ? newItem : m) : [...menuItems, newItem]);
    setEditingItem(null);
  };

  const deleteItem = async (id) => {
    if (await showConfirm('메뉴 삭제', '이 메뉴를 영구히 삭제하시겠습니까?')) {
      api.adminUpdate(adminId, 'menuItems', menuItems.filter(m => m.id !== id));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-gray-700">판매 메뉴 목록</h2>
        <button onClick={() => setEditingItem({})} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm"><Plus className="w-4 h-4" /> 메뉴 추가</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {menuItems.map(item => (
          <div key={item.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 flex flex-col min-h-[160px]">
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="text-xs text-blue-600 font-bold mb-1">{item.category}</div>
                <h3 className="font-bold text-gray-800 text-lg">{item.name}</h3>
                <div className="text-gray-500 text-sm flex-1 mt-1 mb-2 line-clamp-2">{item.description}</div>
              </div>
              <div>
                <div className="font-black text-lg text-gray-900">{item.price.toLocaleString()}원</div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                  <button onClick={() => setEditingItem(item)} className="flex-1 bg-gray-50 text-gray-600 py-2 rounded-lg hover:bg-gray-100 flex justify-center items-center gap-1 text-sm font-medium"><Edit className="w-4 h-4" /> 수정</button>
                  <button onClick={() => deleteItem(item.id)} className="flex-1 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 flex justify-center items-center gap-1 text-sm font-medium"><Trash2 className="w-4 h-4" /> 삭제</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingItem && (
        <ModalWrapper title={editingItem.id ? '메뉴 수정' : '새 메뉴 추가'} onClose={() => setEditingItem(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">카테고리</label><input required name="category" defaultValue={editingItem.category} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="예: 음료, 식사" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">메뉴명</label><input required name="name" defaultValue={editingItem.name} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="예: 아이스 아메리카노" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">가격 (원)</label><input required type="number" name="price" defaultValue={editingItem.price} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">설명</label><textarea required name="description" defaultValue={editingItem.description} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500" rows="2"></textarea></div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg hover:bg-blue-700 mt-6 shadow-md">저장하기</button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}

function AdminRooms({ rooms, adminId }) {
  const { showConfirm, showAlert } = useModal();
  const handleCheckout = async (roomName, roomId) => {
    if (await showConfirm('퇴실 및 초기화', `[${roomName}] 퇴실 시 주문/호출 내역이 초기화됩니다. 계속할까요?`)) {
      api.clearRoom(adminId, roomId);
      showAlert('초기화 완료', `${roomName}의 내역이 초기화되었습니다.`);
    }
  };

  return (
    <div className="max-w-4xl bg-white rounded-xl shadow-sm p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
        <div><h2 className="text-xl font-black text-gray-800">운영 중인 룸 목록</h2><p className="text-sm text-gray-500 mt-1">손님 퇴실 시 내역을 초기화 할 수 있습니다.</p></div>
      </div>
      <div className="space-y-4">
        {rooms.length === 0 ? <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-lg">할당된 룸이 없습니다.</div> : (
          rooms.map(room => (
            <div key={room.id} className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-5 border border-gray-200 rounded-xl bg-gray-50 hover:bg-white transition-colors gap-4">
              <div className="flex items-center gap-4"><div className="bg-blue-100 p-3 rounded-xl text-blue-600"><Home className="w-6 h-6" /></div><div className="font-black text-gray-900 text-xl">{room.name}</div></div>
              <button onClick={() => handleCheckout(room.name, room.id)} className="w-full lg:w-auto flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded-xl hover:bg-slate-900 font-bold transition-colors shadow-md">
                <RotateCcw className="w-5 h-5" /> 퇴실 처리 (주문 초기화)
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
