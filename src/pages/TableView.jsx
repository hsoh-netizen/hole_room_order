import React, { useState, useContext, useMemo } from 'react';
import { Store, Home, LogOut, FileText, Bell, ShoppingCart, Coffee, Plus } from 'lucide-react';
import { AuthContext, StoreContext, useModal } from '../contexts';
import { api } from '../api/mockBackend';
import { LoadingScreen, ModalWrapper } from '../components';

// ==========================================
// 태블릿 뷰 페이지 (룸에 설치될 태블릿)
// ==========================================
function TabletView() {
  const { session, logout } = useContext(AuthContext);
  const { storeData } = useContext(StoreContext);
  const { showAlert } = useModal();
  
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState('전체');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  const { adminId, roomId } = session;
  const safeData = storeData || { menuItems: [], orders: [], rooms: [] };
  const { menuItems, orders, rooms, storeName } = safeData;

  const currentRoom = rooms.find(r => r.id === roomId);
  const categories = ['전체', ...new Set(menuItems.map(m => m.category))];
  const filteredMenu = activeCategory === '전체' ? menuItems : menuItems.filter(m => m.category === activeCategory);

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const myOrders = useMemo(() => orders.filter(o => o.roomId === roomId), [orders, roomId]);
  const totalOrderedAmount = myOrders.reduce((sum, o) => sum + o.total, 0);

  const addToCart = (item) => {
    setCart(prev => {
      const exist = prev.find(c => c.id === item.id);
      if (exist) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(c => c.id === id ? { ...c, quantity: c.quantity + delta } : c).filter(c => c.quantity > 0));
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    const items = cart.map(({ name, quantity, price }) => ({ name, quantity, price }));
    api.createOrder(adminId, roomId, items, cartTotal);
    setCart([]);
    showAlert('주문 완료', '주문이 주방으로 접수되었습니다.');
  };

  const callAdmin = () => {
    api.createCall(adminId, roomId);
    showAlert('호출 완료', '직원을 호출했습니다. 잠시만 기다려주세요.');
  };

  if (!storeData) return <LoadingScreen />;

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-800 font-sans overflow-hidden">
      <div className="absolute top-0 left-0 right-0 bg-slate-900 text-white p-3 flex justify-between items-center z-50 shadow-md">
        <div className="flex items-center gap-4 ml-2">
          <div className="flex items-center gap-2"><Store className="w-4 h-4 text-blue-400" /><span className="font-bold text-sm">{storeName}</span></div>
          <div className="w-px h-4 bg-slate-700"></div>
          <div className="flex items-center gap-2 text-blue-300 bg-slate-800 px-3 py-1 rounded-full"><Home className="w-4 h-4" /><span className="font-bold text-sm">{currentRoom?.name || '알 수 없음'}</span></div>
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white"><LogOut className="w-4 h-4" /> 기기 로그아웃</button>
      </div>

      <div className="flex w-full h-full pt-[52px]">
        <div className="flex-1 flex flex-col h-full bg-white relative">
          <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-end">
            <div><p className="text-blue-600 font-black mb-1">{currentRoom?.name} 전용 태블릿</p><h1 className="text-3xl md:text-4xl font-black text-gray-900">ROOM SERVICE</h1></div>
            <div className="flex gap-3">
              <button onClick={() => setShowHistoryModal(true)} className="bg-gray-100 text-gray-700 px-5 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-200 active:scale-95"><FileText className="w-6 h-6" /> 내역 ({myOrders.length})</button>
              <button onClick={callAdmin} className="bg-red-50 text-red-600 border border-red-200 px-5 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-red-100 active:scale-95"><Bell className="w-6 h-6" /> 호출</button>
            </div>
          </div>
          <div className="flex gap-2 p-6 md:px-8 overflow-x-auto hide-scrollbar border-b border-gray-50 bg-white">
            {categories.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-6 py-3 rounded-full font-bold whitespace-nowrap transition-colors border shadow-sm ${activeCategory === cat ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{cat}</button>)}
          </div>
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-[#F8F9FA]">
            {filteredMenu.length === 0 ? <div className="text-center py-20 text-gray-400 font-medium">관리자가 등록한 메뉴가 없습니다.</div> : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredMenu.map(item => (
                  <div key={item.id} onClick={() => addToCart(item)} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden flex flex-col active:scale-[0.98] transition-transform cursor-pointer group hover:shadow-md min-h-[160px]">
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div><h3 className="font-bold text-xl text-gray-900 mb-1">{item.name}</h3><p className="text-gray-500 text-sm line-clamp-2">{item.description}</p></div>
                      <div className="mt-4 flex justify-between items-center"><span className="font-black text-lg text-blue-600">{item.price.toLocaleString()}원</span><div className="bg-black text-white p-2.5 rounded-full group-hover:bg-blue-600"><Plus className="w-5 h-5" /></div></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-[-10px_0_20px_rgba(0,0,0,0.02)] z-10">
          <div className="p-6 border-b border-gray-100 flex items-center gap-3"><ShoppingCart className="w-6 h-6 text-gray-800" /><h2 className="text-xl font-bold text-gray-900">장바구니</h2><span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-bold">{cart.reduce((a, b) => a + b.quantity, 0)}개</span></div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
            {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3"><Coffee className="w-16 h-16 opacity-20" /><p className="font-medium">메뉴를 담아주세요</p></div> : (
              cart.map(c => (
                <div key={c.id} className="flex flex-col bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between font-bold text-gray-800 mb-3"><span className="text-lg">{c.name}</span><span className="text-blue-600">{(c.price * c.quantity).toLocaleString()}원</span></div>
                  <div className="flex justify-between items-center border-t border-gray-50 pt-3"><span className="text-gray-400 text-sm font-medium">단가 {c.price.toLocaleString()}원</span>
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-full px-2 py-1">
                      <button onClick={() => updateQuantity(c.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600"><span className="text-xl leading-none font-medium mb-0.5">-</span></button>
                      <span className="font-black text-lg w-4 text-center">{c.quantity}</span>
                      <button onClick={() => updateQuantity(c.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-600"><Plus className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-6 bg-white border-t border-gray-100 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <div className="flex justify-between items-end mb-6"><span className="text-gray-500 font-bold">결제 예정 금액</span><span className="text-3xl font-black text-gray-900 tracking-tight">{cartTotal.toLocaleString()}원</span></div>
            <button onClick={placeOrder} disabled={cart.length === 0} className={`w-full py-5 rounded-2xl font-bold text-xl flex justify-center items-center gap-2 transition-all ${cart.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-gray-800 shadow-xl shadow-black/20 active:scale-[0.98]'}`}>주문 전송</button>
          </div>
        </div>
      </div>

      {showHistoryModal && (
        <ModalWrapper title="주문 명세" onClose={() => setShowHistoryModal(false)}>
           <div className="max-h-[60vh] overflow-y-auto mb-6 pr-2">
              {myOrders.length === 0 ? <div className="text-center py-10 text-gray-400">내역이 없습니다.</div> : (
                <div className="flex flex-col-reverse gap-4">
                  {myOrders.map((order, idx) => (
                    <div key={order.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="font-bold text-gray-800 text-sm">주문 {idx + 1}</span>
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
              <span className="text-gray-500 font-bold">누적 결제 예정 금액</span>
              <span className="text-2xl font-black text-blue-600">{totalOrderedAmount.toLocaleString()}원</span>
           </div>
        </ModalWrapper>
      )}
    </div>
  );
}
