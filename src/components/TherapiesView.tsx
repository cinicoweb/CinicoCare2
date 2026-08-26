import React, { useState, useMemo } from 'react';
import {
  Activity,
  Plus,
  Clock,
  Calendar,
  Trash2,
  Edit2,
  CheckCircle2,
  X,
  Sparkles,
  AlertCircle,
  Pill,
  ChevronRight,
  Filter,
  LayoutGrid,
  List,
  ArrowUpDown
} from 'lucide-react';
import { Patient, Therapy, User } from '../types';

interface TherapiesViewProps {
  patients: Patient[];
  therapies: Therapy[];
  currentUser: User;
  onSaveTherapy: (therapy: Partial<Therapy>) => Promise<void>;
  onDeleteTherapy: (id: string) => Promise<void>;
  onNavigateToGroupSettings: () => void;
}

const COLOR_OPTIONS = [
  { name: 'Azzurro Cielo', value: '#0284c7' },
  { name: 'Teal / Smeraldo', value: '#0d9488' },
  { name: 'Viola / Indaco', value: '#7c3aed' },
  { name: 'Arancione Sole', value: '#ea580c' },
  { name: 'Rosa / Corallo', value: '#e11d48' },
  { name: 'Verde Bosco', value: '#15803d' },
  { name: 'Blu Notte', value: '#1e40af' }
];

const DAYS_MAP = [
  { id: 1, label: 'Lun' },
  { id: 2, label: 'Mar' },
  { id: 3, label: 'Mer' },
  { id: 4, label: 'Gio' },
  { id: 5, label: 'Ven' },
  { id: 6, label: 'Sab' },
  { id: 0, label: 'Dom' }
];

export const TherapiesView: React.FC<TherapiesViewProps> = ({
  patients,
  therapies,
  currentUser,
  onSaveTherapy,
  onDeleteTherapy,
  onNavigateToGroupSettings
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'patient-time' | 'patient-asc' | 'time-asc' | 'time-desc' | 'medication-asc'>('patient-time');
  const [viewMode, setViewMode] = useState<'box' | 'list'>('box');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTherapy, setEditingTherapy] = useState<Therapy | null>(null);

  // Form states
  const [patientId, setPatientId] = useState('');
  const [medicationName, setMedicationName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [timeSlotsInput, setTimeSlotsInput] = useState<string[]>(['08:00']);
  const [newSlot, setNewSlot] = useState('');
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [editingSlotValue, setEditingSlotValue] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [color, setColor] = useState('#0284c7');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isFamilyAdmin = currentUser.isFamilyAdmin || currentUser.role === 'superadmin';

  const openCreateModal = (presetPatientId?: string) => {
    setEditingTherapy(null);
    setPatientId(presetPatientId || (patients[0]?.id || ''));
    setMedicationName('');
    setDosage('');
    setInstructions('');
    setTimeSlotsInput(['08:00']);
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsActive(true);
    setColor(COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].value);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (th: Therapy) => {
    setEditingTherapy(th);
    setPatientId(th.patientId);
    setMedicationName(th.medicationName);
    setDosage(th.dosage || '');
    setInstructions(th.instructions || '');
    setTimeSlotsInput(th.timeSlots || ['08:00']);
    setEditingSlotIndex(null);
    setEditingSlotValue('');
    setSelectedDays(th.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]);
    setStartDate(th.startDate || '');
    setEndDate(th.endDate || '');
    setIsActive(th.isActive);
    setColor(th.color || '#0284c7');
    setError(null);
    setIsModalOpen(true);
  };

  const handleAddTimeSlot = () => {
    if (!newSlot) return;
    if (!timeSlotsInput.includes(newSlot)) {
      setTimeSlotsInput([...timeSlotsInput, newSlot].sort());
    }
    setNewSlot('');
  };

  const handleStartEditSlot = (index: number, currentVal: string) => {
    setEditingSlotIndex(index);
    setEditingSlotValue(currentVal);
  };

  const handleSaveEditedSlot = (index: number) => {
    if (!editingSlotValue) {
      setEditingSlotIndex(null);
      return;
    }
    const updated = [...timeSlotsInput];
    updated[index] = editingSlotValue;
    setTimeSlotsInput(Array.from(new Set(updated)).sort());
    setEditingSlotIndex(null);
    setEditingSlotValue('');
  };

  const handleRemoveTimeSlot = (slot: string) => {
    if (timeSlotsInput.length <= 1) return;
    setTimeSlotsInput(timeSlotsInput.filter(s => s !== slot));
  };

  const toggleDay = (dayId: number) => {
    if (selectedDays.includes(dayId)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter(d => d !== dayId));
      }
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !medicationName.trim()) {
      setError('Seleziona il paziente e inserisci il nome del farmaco');
      return;
    }

    if (timeSlotsInput.length === 0) {
      setError('Inserisci almeno un orario di somministrazione');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSaveTherapy({
        id: editingTherapy?.id,
        patientId,
        medicationName: medicationName.trim(),
        dosage: dosage ? dosage.trim() : '',
        instructions: instructions.trim(),
        timeSlots: timeSlotsInput,
        daysOfWeek: selectedDays,
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate: endDate || null,
        isActive,
        color
      });

      setIsModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Errore salvataggio terapia');
    } finally {
      setSaving(false);
    }
  };

  const sortedAndFilteredTherapies = useMemo(() => {
    const patientMap = new Map<string, string>(patients.map(p => [p.id, p.name.toLowerCase()]));

    return therapies
      .filter(th => {
        if (selectedPatientId !== 'all' && th.patientId !== selectedPatientId) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pA: string = patientMap.get(a.patientId) || '';
        const pB: string = patientMap.get(b.patientId) || '';
        const firstTimeA = a.timeSlots && a.timeSlots.length > 0 ? a.timeSlots[0] : '99:99';
        const firstTimeB = b.timeSlots && b.timeSlots.length > 0 ? b.timeSlots[0] : '99:99';

        switch (sortBy) {
          case 'patient-time': {
            const pDiff = pA.localeCompare(pB);
            if (pDiff !== 0) return pDiff;
            return firstTimeA.localeCompare(firstTimeB);
          }
          case 'patient-asc':
            return pA.localeCompare(pB);
          case 'time-asc':
            return firstTimeA.localeCompare(firstTimeB);
          case 'time-desc':
            return firstTimeB.localeCompare(firstTimeA);
          case 'medication-asc':
            return a.medicationName.localeCompare(b.medicationName);
          default:
            return 0;
        }
      });
  }, [therapies, selectedPatientId, sortBy, patients]);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Section */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-700" />
            Configurazione Terapie Farmacologiche
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Imposta i farmaci, i dosaggi, gli orari precisi di somministrazione e i giorni di terapia per ciascun paziente.
          </p>
        </div>

        {isFamilyAdmin && (
          <button
            onClick={() => openCreateModal()}
            disabled={patients.length === 0}
            className="px-4 py-2.5 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Nuova Terapia Farmaco
          </button>
        )}
      </div>

      {/* If No Patients Created yet */}
      {patients.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-sm">Nessun paziente ancora registrato nel gruppo</h4>
            <p className="text-xs text-amber-800 mt-1">
              Prima di configurare le terapie farmacologiche, inserisci i pazienti nella sezione Anagrafica Gruppo.
            </p>
          </div>
          <button
            onClick={onNavigateToGroupSettings}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            Vai in Anagrafica Pazienti →
          </button>
        </div>
      )}

      {/* Controls Bar: Filters, Sorting & View Toggle */}
      {patients.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Patient Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> Paziente:
            </span>
            <button
              onClick={() => setSelectedPatientId('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                selectedPatientId === 'all'
                  ? 'bg-sky-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tutti ({therapies.length})
            </button>
            {patients.map(p => {
              const count = therapies.filter(t => t.patientId === p.id).length;
              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                    selectedPatientId === p.id
                      ? 'bg-sky-700 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {p.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Sort & View Mode Switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            {/* Sort Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5" /> Ordina:
              </span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-sky-600 focus:bg-white cursor-pointer"
              >
                <option value="patient-time">Paziente & Orario</option>
                <option value="patient-asc">Paziente (A-Z)</option>
                <option value="time-asc">Orario (Crescente)</option>
                <option value="time-desc">Orario (Decrescente)</option>
                <option value="medication-asc">Farmaco (A-Z)</option>
              </select>
            </div>

            {/* View Mode Toggle: Box vs List */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setViewMode('box')}
                title="Vista a Box (Griglia Schede)"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'box'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Box</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Vista a Lista (Elenco Compatto)"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Lista</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {sortedAndFilteredTherapies.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
          <div className="w-16 h-16 bg-sky-50 text-sky-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Pill className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Nessuna terapia attiva per questo filtro</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Aggiungi i farmaci prescritti con posologia e orari per iniziare il piano terapeutico.
          </p>
          {isFamilyAdmin && (
            <button
              onClick={() => openCreateModal()}
              disabled={patients.length === 0}
              className="px-4 py-2 bg-sky-700 hover:bg-sky-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Aggiungi Terapia
            </button>
          )}
        </div>
      ) : viewMode === 'box' ? (
        /* BOX GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedAndFilteredTherapies.map(th => {
            const patient = patients.find(p => p.id === th.patientId);

            return (
              <div
                key={th.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-shadow relative flex flex-col justify-between"
              >
                <div>
                  {/* Card Header with Color pill & Patient */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: th.color || '#0284c7' }}
                      />
                      <span className="px-2.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold rounded-lg">
                        {patient?.name || 'Paziente'}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      th.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {th.isActive ? 'Attiva' : 'Sospesa'}
                    </span>
                  </div>

                  {/* Drug Name & Optional Dosage */}
                  <h3 className="font-bold text-slate-900 text-lg font-['Outfit'] leading-tight">
                    {th.medicationName}
                  </h3>
                  {th.dosage ? (
                    <div className="text-xs font-semibold text-sky-800 mt-1">
                      Dosaggio: {th.dosage}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-1 italic">
                      Dosaggio: Non specificato
                    </div>
                  )}

                  {/* Instructions */}
                  {th.instructions && (
                    <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      💡 {th.instructions}
                    </p>
                  )}

                  {/* Time Slots */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-700" />
                      Orari di Somministrazione ({th.timeSlots.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {th.timeSlots.map((slot, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 bg-slate-100 font-bold text-slate-800 rounded-lg text-xs border border-slate-200"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Days of Week */}
                  <div className="mt-3">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-sky-700" />
                      Giorni Previsti
                    </div>
                    <div className="flex gap-1">
                      {DAYS_MAP.map(d => {
                        const isDayActive = th.daysOfWeek?.includes(d.id);
                        return (
                          <span
                            key={d.id}
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              isDayActive
                                ? 'bg-sky-700 text-white'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {d.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Actions for Family Admin */}
                {isFamilyAdmin && (
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(th)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Modifica
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Confermi l'eliminazione della terapia "${th.medicationName}"?`)) {
                          await onDeleteTherapy(th.id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina
                    </button>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Paziente</th>
                  <th className="py-3 px-4">Farmaco</th>
                  <th className="py-3 px-4">Dosaggio</th>
                  <th className="py-3 px-4">Orari Somministrazione</th>
                  <th className="py-3 px-4">Giorni</th>
                  <th className="py-3 px-4">Stato</th>
                  {isFamilyAdmin && <th className="py-3 px-4 text-right">Azioni</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedAndFilteredTherapies.map(th => {
                  const patient = patients.find(p => p.id === th.patientId);

                  return (
                    <tr key={th.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Patient */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: th.color || '#0284c7' }}
                          />
                          <span className="font-bold text-slate-900 bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 rounded-lg text-xs">
                            {patient?.name || 'Paziente'}
                          </span>
                        </div>
                      </td>

                      {/* Drug Name & Notes */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm font-['Outfit']">{th.medicationName}</div>
                        {th.instructions && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs" title={th.instructions}>
                            💡 {th.instructions}
                          </div>
                        )}
                      </td>

                      {/* Dosage */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {th.dosage ? (
                          <span className="font-semibold text-sky-900 bg-sky-50 px-2 py-1 rounded-md text-xs">
                            {th.dosage}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-xs">Facoltativo / Non specificato</span>
                        )}
                      </td>

                      {/* Time Slots */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {th.timeSlots.map((slot, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 bg-slate-100 font-bold text-slate-800 rounded-md text-[11px] border border-slate-200"
                            >
                              {slot}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Days */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex gap-0.5">
                          {DAYS_MAP.map(d => {
                            const isDayActive = th.daysOfWeek?.includes(d.id);
                            return (
                              <span
                                key={d.id}
                                className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold ${
                                  isDayActive ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-400'
                                }`}
                              >
                                {d.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          th.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {th.isActive ? 'Attiva' : 'Sospesa'}
                        </span>
                      </td>

                      {/* Actions */}
                      {isFamilyAdmin && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEditModal(th)}
                              title="Modifica"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Confermi l'eliminazione della terapia "${th.medicationName}"?`)) {
                                  await onDeleteTherapy(th.id);
                                }
                              }}
                              title="Elimina"
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT THERAPY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-sky-700 to-teal-700 text-white flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg font-['Outfit']">
                  {editingTherapy ? 'Modifica Terapia Farmaco' : 'Nuova Terapia Farmacologica'}
                </h3>
                <p className="text-xs text-sky-100 mt-0.5">Definisci posologia, orari e istruzioni di somministrazione</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs text-slate-700">
              
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Patient Selector */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Paziente Destinatario *</label>
                <select
                  required
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-medium"
                >
                  <option value="">-- Seleziona Paziente --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Medication Name & Optional Dosage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">Nome Farmaco *</label>
                  <input
                    type="text"
                    required
                    value={medicationName}
                    onChange={(e) => setMedicationName(e.target.value)}
                    placeholder="Es. Cardioaspirina, Metformina"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Dosaggio / Posologia <span className="text-slate-400 font-normal">(Facoltativo)</span>
                  </label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="Es. 1 cpr da 100 mg, 20 gocce (opzionale)"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs font-medium"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1">Istruzioni Terapeutiche</label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Es. A stomaco pieno dopo colazione, con abbondante acqua"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none text-xs"
                />
              </div>

              {/* Time Slots configuration with click-to-edit */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold text-slate-800 text-xs">Orari di Somministrazione (HH:MM)</label>
                  <span className="text-[10px] text-sky-700 font-medium">💡 Clicca su un orario per modificarlo</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-2.5">
                  {timeSlotsInput.map((slot, index) => {
                    const isEditingThis = editingSlotIndex === index;
                    if (isEditingThis) {
                      return (
                        <div key={index} className="flex items-center gap-1 bg-white p-1 rounded-xl border-2 border-sky-600 shadow-sm animate-scale-in">
                          <input
                            type="time"
                            value={editingSlotValue}
                            onChange={(e) => setEditingSlotValue(e.target.value)}
                            className="text-xs font-bold text-slate-900 bg-transparent outline-none px-1"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditedSlot(index)}
                            className="p-1 bg-sky-700 hover:bg-sky-800 text-white rounded-lg text-xs"
                            title="Conferma orario modificato"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSlotIndex(null)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg text-xs"
                            title="Annulla modifica"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={slot}
                        className="group px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-950 rounded-xl font-bold text-xs flex items-center gap-1.5 border border-sky-200 shadow-xs cursor-pointer transition-all hover:border-sky-400 select-none"
                        onClick={() => handleStartEditSlot(index, slot)}
                        title="Clicca per modificare questo orario"
                      >
                        <Clock className="w-3.5 h-3.5 text-sky-700" />
                        <span className="underline decoration-dotted underline-offset-2">{slot}</span>
                        <Edit2 className="w-3 h-3 text-sky-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                        {timeSlotsInput.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTimeSlot(slot);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-0.5 ml-1 transition-colors"
                            title="Rimuovi orario"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newSlot}
                    onChange={(e) => setNewSlot(e.target.value)}
                    className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-sky-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddTimeSlot}
                    className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-xl text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Aggiungi Orario
                  </button>
                </div>
              </div>

              {/* Days of Week */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">Giorni della Settimana</label>
                <div className="flex gap-1.5">
                  {DAYS_MAP.map(d => {
                    const isSelected = selectedDays.includes(d.id);
                    return (
                      <button
                        type="button"
                        key={d.id}
                        onClick={() => toggleDay(d.id)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-sky-700 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color badge picker */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">Colore di Riferimento Visivo</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      type="button"
                      key={c.value}
                      onClick={() => setColor(c.value)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === c.value ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-80'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-sky-700 rounded border-slate-300 focus:ring-sky-600"
                  />
                  <span className="font-semibold text-slate-800">Terapia attiva e programmata</span>
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 font-bold text-white bg-sky-700 hover:bg-sky-800 rounded-xl shadow-xs transition-colors"
                >
                  {saving ? 'Salvataggio...' : 'Salva Terapia'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
