import { useState } from 'react'
import { Sparkles, ShoppingCart, CalendarDays, Heart } from 'lucide-react'
import ObjectivesBoard from './components/ObjectivesBoard'
import ShoppingList from './components/ShoppingList'
import CalendarView from './components/CalendarView'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('objectives')

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="nav-container">
          <div className="nav-brand">
            <Heart size={24} color="var(--color-primary)" fill="var(--color-primary)" />
            Nós<span>Dois</span>
          </div>
          
          <div className="nav-tabs">
            <button 
              className={`nav-tab ${activeTab === 'objectives' ? 'active' : ''}`}
              onClick={() => setActiveTab('objectives')}
            >
              <Sparkles size={20} />
              <span>Objetivos</span>
            </button>
            
            <button 
              className={`nav-tab ${activeTab === 'shopping' ? 'active' : ''}`}
              onClick={() => setActiveTab('shopping')}
            >
              <ShoppingCart size={20} />
              <span>Compras</span>
            </button>

            <button 
              className={`nav-tab ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <CalendarDays size={20} />
              <span>Calendário</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content container">
        {activeTab === 'objectives' && (
          <div className="fade-in">
            <h2 style={{ marginBottom: '0.25rem', fontSize: '1.5rem', fontWeight: '600', color: 'var(--color-text)' }}>
              Mural de Sonhos
            </h2>
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              Construindo juntos o nosso futuro.
            </p>
            <ObjectivesBoard />
          </div>
        )}
        
        {activeTab === 'shopping' && (
          <div className="fade-in">
            <h2 style={{ marginBottom: '0.25rem', fontSize: '1.5rem', fontWeight: '600', color: 'var(--color-text)' }}>
              Lista de Compras
            </h2>
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              O que precisamos esse mês?
            </p>
            <ShoppingList />
          </div>
        )}
        
        {activeTab === 'calendar' && (
          <div className="fade-in">
            <CalendarView />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
