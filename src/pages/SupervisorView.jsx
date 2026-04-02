import React, { useState, useContext } from 'react';
import { ShieldCheck, Store, LogOut, Plus, Trash2 } from 'lucide-react';
import { AuthContext, StoreContext, useModal } from '../contexts';
import { api } from '../api/mockBackend';
import { SidebarBtn, ModalWrapper } from '../components';

// ==========================================
// Supervisor View
// ==========================================
function SupervisorView() {
  const { logout } = useContext(AuthContext);
  const { allStores } = useContext(StoreContext);
  const { showAlert, showConfirm } = useModal();
  
  const [storeForm, setStoreForm] = useState(null); 
  const [roomForm, setRoomForm] = useState(null); 

  const handleStoreSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const adminId = storeForm.mode === 'add' ? fd.get('adminId') : storeForm.adminId;
    if (storeForm.mode === 'add' && allStores[adminId]) return showAlert('오류', '이미 존재하는 매장 ID입니다.');
    
    const storeObj = allStores[adminId] || { rooms: [], menuItems: [], orders: [], calls: [] };
    storeObj.password = fd.get('password');
    storeObj.storeName = fd.get('storeName');
    
    api.supervisorUpdate({ ...allStores, [adminId]: storeObj });
    setStoreForm(null);
  };

  const deleteStore = async (adminId) => {
    if (await showConfirm('매장 삭제', '이 매장과 데이터를 영구 삭제하시겠습니까?')) {
      const newStores = { ...allStores };
      delete newStores[adminId];
      api.supervisorUpdate(newStores);
    }
  };

  // 룸 등록 및 수정 로직
  const handleRoomSubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const { adminId, mode, roomId } = roomForm;
    const store = allStores[adminId];
    
    // 같은 매장 내에서 룸 접속 ID 중복 검사
    const newLoginId = fd.get('loginId');
    const isDuplicate = store.rooms.some(r => r.loginId === newLoginId && r.id !== roomId);
    if (isDuplicate) {
      return showAlert('오류', '해당 매장에 이미 동일한 룸 접속 ID가 존재합니다.');
    }

    const newRoom = {
      id: mode === 'add' ? 'room_' + Date.now() : roomId,
      name: fd.get('name'),
      loginId: newLoginId,
      password: fd.get('password')
    };

    const updatedRooms = mode === 'add'
      ? [...store.rooms, newRoom]
      : store.rooms.map(r => r.id === roomId ? newRoom : r);

    api.supervisorUpdate({
      ...allStores,
      [adminId]: { ...store, rooms: updatedRooms }
    });
    setRoomForm(null);
  };

  // 룸 삭제 로직
  const deleteRoom = async (adminId, roomId) => {
    if (await showConfirm('룸 삭제', '해당 룸을 영구 삭제하시겠습니까?')) {
      const store = allStores[adminId];
      api.supervisorUpdate({
        ...allStores,
        [adminId]: { ...store, rooms: store.rooms.filter(r => r.id !== roomId) }
      });
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <div className="w-64 bg-indigo-950 text-white flex flex-col">
        <div className="p-6 text-lg font-black border-b border-indigo-900 flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-indigo-400" /> 슈퍼바이저</div>
        <nav className="flex-1 p-4"><SidebarBtn icon={<Store />} label="매장 관리" active={true} /></nav>
        <div className="p-4"><button onClick={logout} className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 rounded-lg flex items-center justify-center gap-2 font-medium"><LogOut className="w-4 h-4"/> 로그아웃</button></div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 relative">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
            <div>
              <h1 className="text-xl font-bold text-gray-800">전체 매장 관리</h1>
              <p className="text-sm text-gray-500 mt-1">시스템을 이용할 매장을 등록하고 룸(태블릿) 계정을 관리합니다.</p>
            </div>
            <button onClick={() => setStoreForm({mode: 'add'})} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex gap-2 font-bold hover:bg-indigo-700 shadow-sm"><Plus className="w-5 h-5" /> 새 매장 등록</button>
          </div>

          {allStores && Object.entries(allStores).map(([adminId, store]) => (
            <div key={adminId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
               <div className="p-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                 <div>
                   <h3 className="text-xl font-black text-gray-900">{store.storeName}</h3>
                   <div className="flex gap-4 text-sm text-gray-600 bg-white inline-flex px-3 py-1.5 rounded border border-gray-200 mt-2">
                     <span className="flex items-center gap-1"><User className="w-4 h-4"/> <b>ID:</b> {adminId}</span>
                     <div className="w-px bg-gray-300"></div>
                     <span className="flex items-center gap-1"><Key className="w-4 h-4"/> <b>PW:</b> {store.password}</span>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <button onClick={() => setRoomForm({mode:'add', adminId})} className="bg-white border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50 font-bold text-sm flex items-center gap-1"><Smartphone className="w-4 h-4"/> 룸 발급</button>
                   <button onClick={() => setStoreForm({mode:'edit', adminId, ...store})} className="bg-white border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50"><Edit className="w-4 h-4"/></button>
                   <button onClick={() => deleteStore(adminId)} className="bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                 </div>
               </div>
               
               <div className="p-5 bg-white">
                 <h4 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2"><Smartphone className="w-4 h-4"/> 할당된 룸(태블릿) 목록</h4>
                 {store.rooms.length === 0 ? (
                   <div className="text-sm text-gray-400 py-2">등록된 룸이 없습니다.</div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                     {store.rooms.map(room => (
                       <div key={room.id} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:border-indigo-300 transition-colors">
                         <div>
                           <div className="font-bold text-gray-800 mb-1">{room.name}</div>
                           <div className="text-xs text-gray-500 flex gap-2"><span>ID: {room.loginId}</span> / <span>PW: {room.password}</span></div>
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
          ))}
        </div>
      </div>

      {storeForm && (
        <ModalWrapper title={storeForm.mode === 'add' ? '새 매장 등록' : '매장 정보 수정'} onClose={() => setStoreForm(null)}>
          <form onSubmit={handleStoreSubmit} className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">매장명 (표시용)</label><input required name="storeName" defaultValue={storeForm.storeName} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="예: 룸오더 1호점" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">관리자 접속 ID</label><input required name="adminId" defaultValue={storeForm.adminId} readOnly={storeForm.mode === 'edit'} className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${storeForm.mode === 'edit' ? 'bg-gray-100 text-gray-500' : 'focus:ring-2 focus:ring-indigo-500'}`} placeholder="영문/숫자 고유 ID" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-1">접속 비밀번호</label><input required name="password" defaultValue={storeForm.password} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="비밀번호 설정" /></div>
            <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setStoreForm(null)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">취소</button><button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">저장</button></div>
          </form>
        </ModalWrapper>
      )}

      {roomForm && (
        <ModalWrapper title={roomForm.mode === 'add' ? '룸 계정 발급' : '룸 계정 수정'} onClose={() => setRoomForm(null)}>
          <form onSubmit={handleRoomSubmit} className="space-y-4">
            <div><label className="block text-sm font-bold text-gray-700 mb-1">룸 표시 이름</label><input required name="name" defaultValue={roomForm.name} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="예: 4번 방, VIP룸" /></div>
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
              <p className="text-xs font-bold text-indigo-800">태블릿 접속용 계정</p>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">접속 ID</label><input required name="loginId" defaultValue={roomForm.loginId} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="해당 매장 내에서 고유한 ID" /></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-1">비밀번호</label><input required name="password" defaultValue={roomForm.password} className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
            </div>
            <div className="flex justify-end gap-2 pt-4"><button type="button" onClick={() => setRoomForm(null)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">취소</button><button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700">저장</button></div>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}
