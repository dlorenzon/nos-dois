import { useState, useEffect } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { supabase } from '../supabase';
import './CalendarView.css';

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', creator_name: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();

    const channel = supabase
      .channel('calendar_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents((prev) => {
            if (prev.some(ev => ev.id === payload.new.id)) return prev;
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

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.creator_name) return;

    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .insert([
          {
            date: selectedDate.toISOString(),
            title: formData.title,
            description: formData.description,
            creator_name: formData.creator_name
          }
        ])
        .select();
      
      if (error) throw error;

      if (data && data.length > 0) {
        setEvents((prev) => {
          if (prev.some(ev => ev.id === data[0].id)) return prev;
          return [...prev, data[0]];
        });
      }

      setFormData({ title: '', description: '', creator_name: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao adicionar evento:', error.message);
    }
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
                <span className="event-creator">{ev.creator_name}</span>
                <h4>{ev.title}</h4>
                {ev.description && <p>{ev.description}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Evento</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="modal-form">
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
              <button type="submit" className="submit-btn">Salvar Evento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
