import { useState, useEffect } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { NoteEditor } from './components/NoteEditor';
import { Onboarding } from './components/Onboarding';
import { Settings } from './components/Settings';
import { MemoryView } from './components/MemoryView';
import { ReminderView } from './components/ReminderView';
import { MDButton } from './components/common/MDButton';
import { usePWAInstall } from './hooks/usePWAInstall';
import { db } from './services/db';
import { vectorStore } from './services/vectorStore';
import { useLiveQuery } from 'dexie-react-hooks';
import './App.css';

function App() {
  const [view, setView] = useState<'chat' | 'notes' | 'settings' | 'memory' | 'reminders'>('chat');
  const { isInstallable, promptInstall } = usePWAInstall();
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'webos', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      const isMobileDevice = mobileKeywords.some(keyword => userAgent.includes(keyword)) || window.innerWidth <= 800;
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const conversations = useLiveQuery(() => db.conversations.orderBy('updatedAt').reverse().toArray()) || [];

  useEffect(() => {
    const savedScale = localStorage.getItem('APP_FONT_SCALE') || '1';
    document.documentElement.style.setProperty('--app-font-scale', savedScale);

    if (localStorage.getItem('AI_PROVIDER_TYPE')) {
      setIsOnboarded(true);
      const init = async () => {
        await vectorStore.initialize();

        // Find if there's an empty conversation to reuse
        const allConvs = await db.conversations.toArray();
        let emptyConvId: number | null = null;

        for (const conv of allConvs) {
          const msgCount = await db.chat_messages.where('conversationId').equals(conv.id!).count();
          if (msgCount === 0) {
            emptyConvId = conv.id!;
            break;
          }
        }

        if (emptyConvId) {
          setActiveConversationId(emptyConvId);
        } else {
          // If no empty ones, check the most recent one
          const recent = await db.conversations.orderBy('updatedAt').reverse().first();
          if (recent) {
            setActiveConversationId(recent.id!);
          } else {
            // Create initial one if absolutely none exist
            createNewChat();
          }
        }
      };
      init();
    }
  }, []);

  const createNewChat = async () => {
    // Check if an empty chat already exists before creating a new one
    const allConvs = await db.conversations.toArray();
    for (const conv of allConvs) {
      const msgCount = await db.chat_messages.where('conversationId').equals(conv.id!).count();
      if (msgCount === 0) {
        setActiveConversationId(conv.id!);
        setView('chat');
        return;
      }
    }

    // 5 chat limit
    const count = await db.conversations.count();
    if (count >= 5) {
      const oldest = await db.conversations.orderBy('updatedAt').first();
      if (oldest) {
        await db.chat_messages.where('conversationId').equals(oldest.id!).delete();
        await db.conversations.delete(oldest.id!);
      }
    }

    const id = await db.conversations.add({
      title: 'New Chat',
      updatedAt: Date.now()
    });
    setActiveConversationId(id);
    setView('chat');
  };

  if (!isMobile) {
    return (
      <div className="mobile-only-guard">
        <div className="guard-content">
          <span className="material-symbols-rounded">stay_current_portrait</span>
          <h2>Mobile Only Experience</h2>
          <p>Please open this application on your mobile device to continue.</p>
        </div>
      </div>
    );
  }

  if (!isOnboarded) {
    return <Onboarding onComplete={() => setIsOnboarded(true)} />;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <button className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <span className="material-symbols-rounded menu-icon">menu</span>
        </button>
        <h1>
          {view === 'chat' ? 'Kioku' :
            view === 'notes' ? 'My Notes' :
              view === 'memory' ? 'Memory' :
                view === 'reminders' ? 'Reminders' : 'Settings'}
        </h1>
        <div className="header-actions">
          {view === 'chat' && (
            <MDButton variant="text" icon="add" onClick={createNewChat}>
              New Chat
            </MDButton>
          )}
        </div>
      </header>

      {/* Side Menu Drawer */}
      {isMenuOpen && (
        <div className="app-drawer-overlay" onClick={() => setIsMenuOpen(false)}>
          <aside className="app-drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">Menu</div>
            <div className="drawer-item" onClick={() => { setView('chat'); setIsMenuOpen(false); }}>
              <span className="material-symbols-rounded">chat</span> Chat
            </div>

            {/* Chat History Section */}
            <div className="drawer-section-title">Recent Chats</div>
            <div className="drawer-history-list">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`history-item ${activeConversationId === conv.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveConversationId(conv.id!);
                    setView('chat');
                    setIsMenuOpen(false);
                  }}
                >
                  <span className="material-symbols-rounded">chat_bubble</span>
                  <span className="history-title">{conv.title}</span>
                </div>
              ))}
            </div>

            <div className="drawer-divider"></div>
            <div className="drawer-item" onClick={() => { setView('notes'); setIsMenuOpen(false); }}>
              <span className="material-symbols-rounded">description</span> Notes
            </div>
            <div className="drawer-item" onClick={() => { setView('reminders'); setIsMenuOpen(false); }}>
              <span className="material-symbols-rounded">notifications</span> Reminders
            </div>
            <div className="drawer-item" onClick={() => { setView('memory'); setIsMenuOpen(false); }}>
              <span className="material-symbols-rounded">psychology</span> Memory
            </div>

            {isInstallable && (
              <div className="drawer-item install-cta" onClick={() => { promptInstall(); setIsMenuOpen(false); }}>
                <span className="material-symbols-rounded">install_mobile</span> Install Kioku
              </div>
            )}
            <div className="drawer-divider"></div>
            <div className="drawer-item" onClick={() => { setView('settings'); setIsMenuOpen(false); }}>
              <span className="material-symbols-rounded">settings</span> Settings
            </div>
          </aside>
        </div>
      )}

      <main className="app-content">
        {view === 'chat' && activeConversationId && (
          <ChatInterface conversationId={activeConversationId} />
        )}
        {view === 'notes' && <NoteEditor />}
        {view === 'memory' && <MemoryView />}
        {view === 'reminders' && <ReminderView />}
        {view === 'settings' && <Settings />}
      </main>

      {view !== 'settings' && (
        <nav className="app-nav-bar">
          <button
            className={`nav-item ${view === 'chat' ? 'active' : ''}`}
            onClick={() => setView('chat')}
          >
            <span className="material-symbols-rounded">chat</span>
            <span>Chat</span>
          </button>
          <button
            className={`nav-item ${view === 'notes' ? 'active' : ''}`}
            onClick={() => setView('notes')}
          >
            <span className="material-symbols-rounded">description</span>
            <span>Notes</span>
          </button>
          <button
            className={`nav-item ${view === 'reminders' ? 'active' : ''}`}
            onClick={() => setView('reminders')}
          >
            <span className="material-symbols-rounded">notifications</span>
            <span>Reminders</span>
          </button>
          <button
            className={`nav-item ${view === 'memory' ? 'active' : ''}`}
            onClick={() => setView('memory')}
          >
            <span className="material-symbols-rounded">psychology</span>
            <span>Memory</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;
