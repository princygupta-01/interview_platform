import { useState } from 'react';
import Login from './Login';
import Lobby from './Lobby';
import Editor from './Editor';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [currentRoom, setCurrentRoom] = useState(null);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  if (!currentRoom) {
    return (
      <Lobby
        onEnterRoom={(roomId) => setCurrentRoom(roomId)}
        onInvalidToken={() => setIsLoggedIn(false)}
      />
    );
  }

  return (
    <Editor
      key={currentRoom}
      roomId={currentRoom}
      onLeaveRoom={() => setCurrentRoom(null)}
      onLogout={() => {
        setIsLoggedIn(false);
        setCurrentRoom(null);
      }}
    />
  );
}

export default App;