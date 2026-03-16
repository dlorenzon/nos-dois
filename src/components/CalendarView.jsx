import { useState, useEffect } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2, List, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../supabase';
import './CalendarView.css';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', creator_name: '' });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('calendar'); // 'calendar' or 'list'
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('calendar_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents((prev) => {
            if (prev.some(ev => ev.id == payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE') {
          setEvents((prev) => prev.filter(ev => ev.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setEvents((prev) => prev.map(ev => ev.id === payload.new.id ? payload.new : ev));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*');
      
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Erro ao buscar eventos:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const onDateClick = day => setSelectedDate(day);

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.creator_name) return;

    try {
      const eventData = {
        date: editingEvent ? editingEvent.date : selectedDate.toISOString(),
        title: formData.title,
        description: formData.description,
        creator_name: formData.creator_name
      };

      let result;
      if (editingEvent) {
        result = await supabase
          .from('calendar_events')
          .update(eventData)
          .eq('id', editingEvent.id)
          .select();
      } else {
        result = await supabase
          .from('calendar_events')
          .insert([eventData])
          .select();
      }
      
      const { data, error } = result;
      
      if (error) throw error;

      if (data && data.length > 0) {
        setEvents((prev) => {
          if (editingEvent) {
            return prev.map(ev => ev.id === editingEvent.id ? data[0] : ev);
          } else {
            if (prev.some(ev => ev.id == data[0].id)) return prev;
            return [...prev, data[0]];
          }
        });
      } else {
        fetchEvents();
      }

      closeModal();
    } catch (error) {
      console.error('Erro ao salvar evento:', error.message);
      alert('Erro ao salvar evento: ' + error.message);
    }
  };

  const handleDeleteEvent = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setEvents(prev => prev.filter(ev => ev.id !== id));
    } catch (error) {
      console.error('Erro ao excluir evento:', error.message);
      alert('Erro ao excluir evento: ' + error.message);
    }
  };

  const openEditModal = (event, e) => {
    e.stopPropagation();
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      creator_name: event.creator_name
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setFormData({ title: '', description: '', creator_name: '' });
  };

  const getEventsForDay = (day) => {
    return events.filter(e => e.date && isSameDay(parseISO(e.date), day));
  };

  const selectedDayEvents = getEventsForDay(selectedDate);

  // Generates calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const dateFormat = "d";
  const rows = [];
  
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;
      const dayEvents = getEventsForDay(cloneDay);
      
      days.push(
        <div
          className={`col cell ${
            !isSameMonth(day, monthStart)
              ? "disabled"
              : isSameDay(day, selectedDate)
              ? "selected"
              : ""
          }`}
          key={day.toString()}
          onClick={() => onDateClick(cloneDay)}
        >
          <span className="number">{formattedDate}</span>
          {dayEvents.length > 0 && <span className="event-dot"></span>}
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="row" key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  const weekDays = [];
  let wDay = startOfWeek(currentDate);
  for (let i = 0; i < 7; i++) {
    weekDays.push(
      <div className="col col-center" key={i}>
        {format(wDay, "EEE", { locale: ptBR }).toUpperCase()}
      </div>
    );
    wDay = addDays(wDay, 1);
  }

  if (loading) return <div className="empty-state"><p>Carregando calendário...</p></div>;

  return (
    <div className="calendar-container">
      {/* Upper Header and Control Bar */}
      <div className="calendar-main-header">
        <div className="title-section">
          <h2>Nosso Calendário</h2>
          <p>Momentos especiais e compromissos.</p>
        </div>
        <div className="view-toggle">
          <button 
            className={`toggle-btn ${view === 'calendar' ? 'active' : ''}`}
            onClick={() => setView('calendar')}
            title="Calendário"
          >
            <CalendarIcon size={18} /> <span className="btn-text">Calendário</span>
          </button>
          <button 
            className={`toggle-btn ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
            title="Ver em Lista"
          >
            <List size={18} /> <span className="btn-text">Ver em Lista</span>
          </button>
        </div>
      </div>

      {view === 'calendar' ? (
        <>
          {/* Header Month/Year */}
          <div className="calendar-header">
            <button onClick={prevMonth} className="nav-btn"><ChevronLeft /></button>
            <h2>{format(currentDate, "MMMM yyyy", { locale: ptBR })}</h2>
            <button onClick={nextMonth} className="nav-btn"><ChevronRight /></button>
          </div>

          {/* Days of Week */}
          <div className="days-row">
            {weekDays}
          </div>

          {/* Calendar Grid */}
          <div className="calendar-body">
            {rows}
          </div>

          {/* Selected Day Events */}
          <div className="events-panel">
            <div className="events-header">
              <h3>Eventos em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</h3>
              <button className="add-event-btn" onClick={() => setIsModalOpen(true)}>
                <Plus size={16} /> Adicionar
              </button>
            </div>

            <div className="events-list">
              {selectedDayEvents.length === 0 ? (
                <p className="no-events">Nenhum evento registrado para este dia.</p>
              ) : (
                selectedDayEvents.map(ev => (
                  <div key={ev.id} className="event-card fade-in">
                    <div className="event-card-header">
                      <span className="event-creator">{ev.creator_name}</span>
                      <div className="event-actions">
                        <button onClick={(e) => openEditModal(ev, e)} className="action-btn edit" title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={(e) => handleDeleteEvent(ev.id, e)} className="action-btn delete" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <h4>{ev.title}</h4>
                    {ev.description && <p>{ev.description}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="events-list-view">
          <div className="list-view-header">
            <h3>Todos os Eventos</h3>
            <button className="add-event-btn" onClick={() => {
              setSelectedDate(new Date());
              setIsModalOpen(true);
            }}>
              <Plus size={16} /> Adicionar Evento
            </button>
          </div>
          <div className="full-events-list">
            {events.length === 0 ? (
              <p className="no-events">Nenhum evento registrado ainda.</p>
            ) : (
              [...events]
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(ev => (
                  <div key={ev.id} className="event-card list-item fade-in">
                    <div className="event-date-badge">
                      <span className="day">{format(parseISO(ev.date), "dd")}</span>
                      <span className="month">{format(parseISO(ev.date), "MMM", { locale: ptBR })}</span>
                    </div>
                    <div className="event-content">
                      <div className="event-card-header">
                        <span className="event-creator">{ev.creator_name}</span>
                        <div className="event-actions">
                          <button onClick={(e) => openEditModal(ev, e)} className="action-btn edit" title="Editar">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={(e) => handleDeleteEvent(ev.id, e)} className="action-btn delete" title="Excluir">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <h4>{ev.title}</h4>
                      {ev.description && <p>{ev.description}</p>}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</h3>
              <button className="close-btn" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="modal-form">
              <div className="form-group">
                <label>Seu Nome</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Ex: Daniel" 
                  value={formData.creator_name}
                  onChange={e => setFormData({...formData, creator_name: e.target.value})}
                />
              </div>
              {!editingEvent && (
                <div className="form-group">
                  <label>Data</label>
                  <div className="selected-date-display">
                    {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label>Título do Evento</label>
                <input 
                  type="text" 
                  required 
                  placeholder="O que vai acontecer?" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Descrição (Opcional)</label>
                <textarea 
                  rows="2" 
                  placeholder="Horário, local, etc..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <button type="submit" className="submit-btn">
                {editingEvent ? 'Salvar Alterações' : 'Salvar Evento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
