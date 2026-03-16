import { useState, useEffect } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../supabase';
import './ObjectivesBoard.css';

export default function ObjectivesBoard() {
  const [objectives, setObjectives] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', title: '', description: '' });
  const [loading, setLoading] = useState(true);

  // Buscar objetivos e assinar as mudanças em tempo real
  useEffect(() => {
    fetchObjectives();

    const channel = supabase
      .channel('objectives_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'objectives' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setObjectives((prev) => {
            if (prev.some(obj => obj.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setObjectives((prev) => prev.filter(obj => obj.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setObjectives((prev) => prev.map(obj => obj.id === payload.new.id ? payload.new : obj));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from('objectives')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setObjectives(data || []);
    } catch (error) {
      console.error('Erro ao buscar objetivos:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este objetivo?')) {
      // Otimisticamente remover da UI será tratado localmente caso preferir, 
      // mas como temos realtime, ao deletar no banco, a UI atualiza sozinha.
      // Contudo, é boa prática dar feedback instantâneo e deixar o realtime ser fallback.
      try {
        const { error } = await supabase.from('objectives').delete().eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Erro ao deletar:', error.message);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.title) return;

    try {
      const { data, error } = await supabase
        .from('objectives')
        .insert([
          {
            creator_name: formData.name,
            title: formData.title,
            description: formData.description
          }
        ])
        .select();
      
      if (error) throw error;

      if (data && data.length > 0) {
        setObjectives((prev) => {
          if (prev.some(obj => obj.id === data[0].id)) return prev;
          return [data[0], ...prev];
        });
      }

      setFormData({ name: '', title: '', description: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar objetivo:', error.message);
      alert('Erro ao salvar o objetivo. Verifique console.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  };

  const getCardStyle = (name) => {
    const isPrimaryColor = name && name.length % 2 === 0;
    return {
      backgroundColor: isPrimaryColor ? 'var(--color-primary-light)' : 'var(--color-surface)',
    };
  };

  if (loading) return <div className="empty-state"><p>Carregando nossos sonhos...</p></div>;

  return (
    <div className="objectives-container">
      {objectives.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum objetivo ainda. Adicione o primeiro sonho de vocês!</p>
        </div>
      ) : (
        <div className="objectives-grid">
          {objectives.map(obj => (
            <div key={obj.id} className="objective-card fade-in" style={getCardStyle(obj.creator_name)}>
              <div className="card-header">
                <span className="creator-tag">{obj.creator_name}</span>
                <button className="delete-btn" onClick={() => handleDelete(obj.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
              <h3 className="card-title">{obj.title}</h3>
              {obj.description && <p className="card-desc">{obj.description}</p>}
              <div className="card-footer">
                <span className="date-text">{formatDate(obj.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="fab-button" onClick={() => setIsModalOpen(true)}>
        <Plus size={24} />
      </button>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Sonho</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Seu Nome</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Daniel" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Título do Objetivo</label>
                <input 
                  type="text" 
                  required 
                  placeholder="O que vamos conquistar juntos?" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Descrição (Opcional)</label>
                <textarea 
                  rows="3" 
                  placeholder="Detalhes adicionais..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <button type="submit" className="submit-btn">Adicionar</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
