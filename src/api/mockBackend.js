// ==========================================
// [Backend & API Layer]
// 프로덕션에서는 Node.js + DB 로 분리되어야 할 서버 로직입니다
// 프론트엔드는 이 DB에 직접 접근하지 못하고 API 함수만 호출
// ==========================================

// 테스트용 자체 이벤트 에미터 (Socket.io 대체)
class EventEmitter {
  constructor() { this.listeners = {}; }
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  off(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(l => l !== cb);
  }
  emit(event, data) {
    if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
  }
}
const socketMock = new EventEmitter();

// 테스트용 하드코딩 데이터베이스 (생성 데이터는 서버에 저장)
let globalDB = {
  'admin': {
    password: 'admin',
    storeName: '룸오더 1호점 (테스트)',
    rooms: [
      { id: 'test_room_1', name: '테스트 1번방', loginId: 'test1', password: '1' },
      { id: 'test_room_2', name: '테스트 2번방', loginId: 'test2', password: '1' }
    ],
    menuItems: [
      { id: 'm_1', name: '아메리카노', price: 4500, category: '음료', description: '매머드 커피 원두는 뭘 쓰는걸까' },
      { id: 'm_2', name: '말린망고', price: 25000, category: '스낵', description: '설탕 없이도 달달한 말린 망고' }
    ],
    orders: [],
    calls: []
  }
};

// 프론트엔드에서 호출할 API
const api = {
  login: async (role, id, pw) => {
    // 서버에서 검증 로직 수행
    if (role === 'supervisor') {
      if (id === 'ratel' && pw === '1q2w3e4r!') return { role, token: 'super_token' };
      throw new Error('관리자 계정 정보가 일치하지 않습니다.');
    }
    if (role === 'admin') {
      const store = globalDB[id];
      if (store && store.password === pw) return { role, adminId: id, token: `admin_${id}` };
      throw new Error('매장 ID 또는 비밀번호가 일치하지 않습니다.');
    }
    if (role === 'tablet') {
      for (const [adminId, store] of Object.entries(globalDB)) {
        const room = store.rooms.find(r => r.loginId === id && r.password === pw);
        if (room) return { role, adminId, roomId: room.id, token: `tab_${adminId}_${room.id}` };
      }
      throw new Error('룸 ID 또는 비밀번호가 일치하지 않습니다.');
    }
  },
  
  // 상태 변경 액션들 (Race Condition 방지)
createOrder: async (adminId, roomId, items, total) => {
    const newOrder = { id: 'ord_' + Date.now() + Math.random().toString(36).substr(2, 5), roomId, items, total, status: 'pending', timestamp: Date.now() };
    if (globalDB[adminId]) {
      globalDB[adminId] = {
        ...globalDB[adminId],
        orders: [...globalDB[adminId].orders, newOrder] // 배열 새로 생성 (push 사용 X)
      };
      socketMock.emit(`update_${adminId}`, globalDB[adminId]);
    }
  },
  
  completeOrder: async (adminId, orderId) => {
    const store = globalDB[adminId];
    if (store) {
      globalDB[adminId] = {
        ...store,
        orders: store.orders.map(o => o.id === orderId ? { ...o, status: 'completed' } : o) // 불변성 유지
      };
      socketMock.emit(`update_${adminId}`, globalDB[adminId]);
    }
  },
  
  createCall: async (adminId, roomId) => {
    const newCall = { id: 'call_' + Date.now() + Math.random().toString(36).substr(2, 5), roomId, status: 'pending', timestamp: Date.now() };
    if (globalDB[adminId]) {
      globalDB[adminId] = {
        ...globalDB[adminId],
        calls: [...globalDB[adminId].calls, newCall]
      };
      socketMock.emit(`update_${adminId}`, globalDB[adminId]);
    }
  },
  
  resolveCall: async (adminId, callId) => {
    const store = globalDB[adminId];
    if (store) {
      globalDB[adminId] = {
        ...store,
        calls: store.calls.map(c => c.id === callId ? { ...c, status: 'resolved' } : c)
      };
      socketMock.emit(`update_${adminId}`, globalDB[adminId]);
    }
  },
  
  clearRoom: async (adminId, roomId) => {
    const store = globalDB[adminId];
    if (store) {
      globalDB[adminId] = {
        ...store,
        orders: store.orders.filter(o => o.roomId !== roomId),
        calls: store.calls.filter(c => c.roomId !== roomId)
      };
      socketMock.emit(`update_${adminId}`, globalDB[adminId]);
    }
  },
  
  adminUpdate: async (adminId, key, newData) => {
    if (globalDB[adminId]) {
      globalDB[adminId] = {
        ...globalDB[adminId],
        [key]: newData
      };
      socketMock.emit(`update_${adminId}`, globalDB[adminId]);
    }
  },
  
  supervisorUpdate: async (newData) => {
    globalDB = newData;
    socketMock.emit('update_supervisor', globalDB);
  }
};