import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../supabase';
import './ShoppingList.css';

export default function ShoppingList() {
  const [items, setItems] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('brusque');

  const categories = [
    { id: 'brusque', label: 'Brusque' },
    { id: 'pomerode', label: 'Pomerode' },
    { id: 'balneario', label: 'Balneário' }
  ];

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel('shopping_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setItems((prev) => {
            // Evita duplicatas se já adicionamos manualmente no handleAddItem
            if (prev.some(item => item.id == payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.eventType === 'DELETE') {
          setItems((prev) => prev.filter(item => item.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setItems((prev) => prev.map(item => item.id === payload.new.id ? payload.new : item));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Erro ao buscar itens de compra:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    const name = inputValue.trim();
    if (!name) return;

    try {
      const { data, error } = await supabase
        .from('shopping_items')
        .insert([
          { 
            name, 
            is_completed: false,
            category: activeCategory 
          }
        ])
        .select();
      
      if (error) throw error;
      
      setInputValue(''); // Limpa só se deu certo
      
      if (data && data.length > 0) {
        const newItem = data[0];
        setItems((prev) => {
          // Usa == para comparar string com número se necessário
          if (prev.some(item => item.id == newItem.id)) return prev;
          return [newItem, ...prev];
        });
      } else {
        // Fallback: se o select não retornou nada, força um refresh
        fetchItems();
      }
    } catch (error) {
      console.error('Erro ao adicionar item:', error.message);
      alert('Não foi possível adicionar o item: ' + error.message);
    }
  };

  const handleToggle = async (item) => {
    try {
      // Otimisticamente atualiza a UI local antes da resposta para parecer instantâneo
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: !i.is_completed } : i));
      
      const { error } = await supabase
        .from('shopping_items')
        .update({ is_completed: !item.is_completed })
        .eq('id', item.id);
        
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao dar toggle no item:', error.message);
      // Revert optimism if error
      fetchItems();
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase.from('shopping_items').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Erro ao deletar item:', error.message);
    }
  };

  // Filter items by active category
  // If item doesn't have a category, treat it as 'brusque' (default)
  const filteredItems = items.filter(item => {
    const itemCategory = item.category || 'brusque';
    return itemCategory === activeCategory;
  });

  // Sort: pending first, then completed. Then sort by created_at descending
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.is_completed === b.is_completed) {
       // Se o item é novo e ainda não tem data (muito raro agora com o .select()), joga pra cima
       const dateA = a.created_at ? new Date(a.created_at).getTime() : Date.now();
       const dateB = b.created_at ? new Date(b.created_at).getTime() : Date.now();
       return dateB - dateA;
    }
    return a.is_completed ? 1 : -1;
  });

  if (loading) return <div className="empty-state"><p>Carregando lista...</p></div>;

  return (
    <div className="shopping-container">
      <div className="category-selector">
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleAddItem} className="add-item-form">
        <input 
          type="text"
          placeholder={`Adicionar em ${categories.find(c => c.id === activeCategory)?.label}...`}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          className="add-item-input"
        />
        <button type="submit" className="add-item-btn" disabled={!inputValue.trim()}>
          <Plus size={20} />
        </button>
      </form>

      <div className="shopping-list">
        {sortedItems.length === 0 ? (
          <div className="empty-state">
            <p>Lista vazia para {categories.find(c => c.id === activeCategory)?.label}.</p>
          </div>
        ) : (
          sortedItems.map(item => (
            <div 
              key={item.id} 
              className={`shopping-item ${item.is_completed ? 'completed' : ''}`}
            >
              <label className="checkbox-container">
                <input 
                  type="checkbox"
                  checked={item.is_completed}
                  onChange={() => handleToggle(item)}
                />
                <span className="checkmark"></span>
              </label>
              
              <span className="item-name">{item.name}</span>
              
              <button 
                type="button" 
                className="delete-item-btn" 
                onClick={() => handleDelete(item.id)}
                aria-label="Deletar item"
              >
                <X size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
