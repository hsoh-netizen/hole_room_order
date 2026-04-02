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

  // 룸 등록 로직 생략(App 로직과 동일하되 api.supervisorUpdate 이용)
  // 편의상 축소 구현
  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      <div className="w-64 bg-indigo-950 text-white flex flex-col">
        <div className="p-6 text-lg font-black border-b border-indigo-900 flex items-center gap-2"><ShieldCheck className="w-7 h-7 text-indigo-400" /> 전체관리자</div>
        <nav className="flex-1 p-4"><SidebarBtn icon={<Store />} label="매장 관리" active={true} /></nav>
        <div className="p-4"><button onClick={logout} className="w-full py-3 bg-indigo-900 hover:bg-indigo-800 rounded-lg">로그아웃</button></div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center"><h1 className="text-xl font-bold">전체 매장 관리</h1><button onClick={() => setStoreForm({mode: 'add'})} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg flex gap-2"><Plus className="w-5 h-5" /> 새 매장 등록</button></div>
          {allStores && Object.entries(allStores).map(([adminId, store]) => (
            <div key={adminId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
               <div className="p-5 border-b flex justify-between items-center">
                 <h3 className="text-xl font-black">{store.storeName} ({adminId})</h3>
                 <button onClick={() => deleteStore(adminId)} className="text-red-500 p-2"><Trash2 className="w-5 h-5"/></button>
               </div>
               <div className="p-5">룸 갯수: {store.rooms.length} / 메뉴 갯수: {store.menuItems.length}</div>
            </div>
          ))}
        </div>
      </div>

      {storeForm && (
        <ModalWrapper title={storeForm.mode === 'add' ? '새 매장 등록' : '수정'} onClose={() => setStoreForm(null)}>
          <form onSubmit={handleStoreSubmit} className="space-y-4">
            <div><label>매장명</label><input required name="storeName" defaultValue={storeForm.storeName} className="w-full border p-2" /></div>
            <div><label>ID</label><input required name="adminId" defaultValue={storeForm.adminId} readOnly={storeForm.mode === 'edit'} className="w-full border p-2" /></div>
            <div><label>PW</label><input required name="password" defaultValue={storeForm.password} className="w-full border p-2" /></div>
            <button className="w-full bg-indigo-600 text-white py-3 rounded-xl mt-4">저장</button>
          </form>
        </ModalWrapper>
      )}
    </div>
  );
}
