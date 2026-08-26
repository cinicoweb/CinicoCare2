import React, { useState, useMemo } from 'react';
import {
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Download,
  FileText,
  User as UserIcon,
  Check,
  TrendingUp,
  Percent
} from 'lucide-react';
import { DoseLog, Patient, Therapy, User } from '../types';

interface HistoryViewProps {
  doseLogs: DoseLog[];
  patients: Patient[];
  therapies: Therapy[];
  members: User[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  doseLogs,
  patients,
  therapies,
  members
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Enrich dose logs with therapy and patient details
  const enrichedLogs = useMemo(() => {
    return doseLogs.map(log => {
      const therapy = therapies.find(t => t.id === log.therapyId);
      const patient = patients.find(p => p.id === log.patientId);
      return {
        ...log,
        therapyName: therapy?.medicationName || 'Farmaco',
        dosage: therapy?.dosage || '',
        patientName: patient?.name || 'Paziente',
        color: therapy?.color || '#0284c7'
      };
    }).sort((a, b) => {
      // Sort newest first
      const dateA = a.takenAt || `${a.scheduledDate}T${a.scheduledTime}:00`;
      const dateB = b.takenAt || `${b.scheduledDate}T${b.scheduledTime}:00`;
      return dateB.localeCompare(dateA);
    });
  }, [doseLogs, therapies, patients]);

  // Filtered
  const filteredLogs = useMemo(() => {
    return enrichedLogs.filter(log => {
      if (selectedPatientId !== 'all' && log.patientId !== selectedPatientId) return false;
      if (selectedStatus !== 'all' && log.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = log.therapyName.toLowerCase().includes(q);
        const matchesPatient = log.patientName.toLowerCase().includes(q);
        const matchesCaregiver = (log.takenByUserName || '').toLowerCase().includes(q);
        const matchesNotes = (log.notes || '').toLowerCase().includes(q);
        if (!matchesName && !matchesPatient && !matchesCaregiver && !matchesNotes) return false;
      }
      return true;
    });
  }, [enrichedLogs, selectedPatientId, selectedStatus, searchQuery]);

  // Stats calculation
  const totalRecorded = enrichedLogs.length;
  const takenCount = enrichedLogs.filter(l => l.status === 'taken').length;
  const skippedCount = enrichedLogs.filter(l => l.status === 'skipped').length;
  const adherenceRate = totalRecorded > 0 ? Math.round((takenCount / totalRecorded) * 100) : 100;

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('Nessun dato da esportare');
      return;
    }

    const headers = ['Data Prevista', 'Orario Previsto', 'Paziente', 'Farmaco', 'Dosaggio', 'Stato', 'Somministrato Da', 'Data/Ora Effettiva', 'Note'];
    const rows = filteredLogs.map(l => [
      l.scheduledDate,
      l.scheduledTime,
      `"${l.patientName}"`,
      `"${l.therapyName}"`,
      `"${l.dosage}"`,
      l.status === 'taken' ? 'Somministrato' : (l.status === 'skipped' ? 'Saltato' : 'In Sospeso'),
      `"${l.takenByUserName || ''}"`,
      l.takenAt ? new Date(l.takenAt).toLocaleString('it-IT') : '',
      `"${(l.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CinicoCare_Storico_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-['Outfit'] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-sky-700" />
            Storico Assunzioni & Tracciabilità in Tempo Reale
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Registro cronologico certificato delle somministrazioni effettuate da familiari e caregiver.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          Esporta CSV / Report
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Aderenza Terapeutica</span>
            <div className="text-3xl font-extrabold text-sky-800 mt-1 font-['Outfit']">{adherenceRate}%</div>
            <div className="text-xs text-slate-500 mt-0.5">Terapie somministrate con successo</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dosi Confermate</span>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1 font-['Outfit']">{takenCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Registrate nel sistema</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dosi Saltate / Sospese</span>
            <div className="text-3xl font-extrabold text-slate-700 mt-1 font-['Outfit']">{skippedCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">Con motivazione nelle note</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search Query */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca per farmaco, paziente, caregiver o note..."
            className="w-full pl-10 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-600 outline-none"
          />
        </div>

        {/* Patient Filter */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">Tutti i Pazienti</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:bg-white"
          >
            <option value="all">Tutti gli Stati</option>
            <option value="taken">Solo Somministrati</option>
            <option value="skipped">Solo Saltati</option>
          </select>
        </div>

      </div>

      {/* History Table / Cards */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center border border-slate-200/80 shadow-xs">
          <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Nessuna registrazione trovata</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Lo storico si popola automaticamente ogni volta che un familiare o caregiver spunta una dose nella scheda Oggi.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Data & Orario</th>
                  <th className="py-3 px-4">Paziente</th>
                  <th className="py-3 px-4">Farmaco & Posologia</th>
                  <th className="py-3 px-4">Stato</th>
                  <th className="py-3 px-4">Caregiver / Firma</th>
                  <th className="py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(log => {
                  const isTaken = log.status === 'taken';
                  const isSkipped = log.status === 'skipped';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.scheduledDate}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-sky-700" />
                          Previsto ore {log.scheduledTime}
                        </div>
                      </td>

                      {/* Patient */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-sky-900 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                          {log.patientName}
                        </span>
                      </td>

                      {/* Drug & Dosage */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: log.color }}
                          />
                          <div>
                            <div className="font-bold text-slate-900">{log.therapyName}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{log.dosage}</div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isTaken ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Somministrato
                          </span>
                        ) : isSkipped ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Saltato
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold text-[11px]">
                            In Sospeso
                          </span>
                        )}
                      </td>

                      {/* Caregiver signature */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.takenByUserName ? (
                          <div>
                            <div className="font-semibold text-slate-900">{log.takenByUserName}</div>
                            {log.takenAt && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(log.takenAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                        {log.notes ? (
                          <span className="italic bg-slate-50 p-1.5 rounded-md border border-slate-100 block">
                            "{log.notes}"
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
