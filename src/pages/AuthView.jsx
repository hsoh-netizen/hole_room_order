import React, { useState, useContext } from 'react';
import { User, Lock, LogIn, ShieldCheck, Store } from 'lucide-react';
import { AuthContext } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';

// ==========================================
// [Pages (Views)]
// ==========================================
function AuthView() {
  const { login } = useContext(AuthContext);
  const { showAlert } = useModal();
  const [tab, setTab] = useState('admin');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    try {
      await login(tab, fd.get('loginId'), fd.get('password'));
    } catch (err) {
      showAlert('로그인 실패. 계정 분실 시 관리자에게 문의해주세요.', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-600/20 rounded-full blur-[100px]"></div>

      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden z-10">
        <div className="flex text-center border-b border-gray-100 bg-gray-50/50 text-sm">
          <button onClick={() => setTab('admin')} className={`flex-1 py-4 font-bold transition-colors ${tab === 'admin' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>매장 관리자</button>
          <button onClick={() => setTab('tablet')} className={`flex-1 py-4 font-bold transition-colors ${tab === 'tablet' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>룸 태블릿</button>
          <button onClick={() => setTab('supervisor')} className={`flex-1 py-4 font-bold transition-colors ${tab === 'supervisor' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>슈퍼바이저</button>
        </div>

        <div className="p-8">
          <div className="mb-8 text-center">
            {tab === 'supervisor' ? <ShieldCheck className="w-12 h-12 text-indigo-600 mx-auto mb-3" /> : <Store className="w-12 h-12 text-blue-600 mx-auto mb-3" />}
            <h1 className="text-2xl font-black text-gray-900 mb-2">
              {tab === 'supervisor' ? 'SUPERVISOR SYSTEM' : 'ROOM ORDER SYSTEM'}
            </h1>
            <p className="text-gray-500 text-sm">
              {tab === 'supervisor' && '매장 생성 및 통합 계정 관리'}
              {tab === 'admin' && '매장 관리자 계정으로 로그인하세요.'}
              {tab === 'tablet' && '할당받은 룸 접속 코드를 입력하세요.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">
                {tab === 'supervisor' ? '관리자 ID' : tab === 'admin' ? '매장 관리자 ID' : '룸 접속 ID'}
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
            <button disabled={loading} type="submit" className={`w-full text-white font-bold py-3.5 rounded-xl mt-6 shadow-md transition-colors flex justify-center items-center gap-2 ${tab === 'supervisor' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-50`}>
              <LogIn className="w-5 h-5" /> {loading ? '인증 중...' : '접속하기'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}