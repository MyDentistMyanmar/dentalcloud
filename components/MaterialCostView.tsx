import React, { useMemo, useState } from 'react';
import { Loader2, Package, Plus, RotateCw, Search } from 'lucide-react';
import type { ClinicalRecord } from '../types';
import { api } from '../services/api';
import { formatCurrency, type Currency } from '../utils/currency';
import { toLocalISODate } from '../utils/auditLogFilters';
import { filterAuditLogRowsForExport, type AuditExportRow } from '../utils/auditLogExport';
import { formatTeethWithPosition } from '../utils/toothNumbering';
import { formatDoctorName } from '../utils/doctorName';
import {
  calculateMaterialAdjustedDoctorEarnings,
  calculateMaterialNetProfit
} from '../utils/materialCostCalculations';
import Pagination from './Pagination';
import MaterialCostModal from './MaterialCostModal';

interface MaterialCostViewProps {
  records: ClinicalRecord[];
  loading: boolean;
  currency: Currency;
  canManageMaterials: boolean;
  onRefresh: () => void | Promise<void>;
}

type TreatmentAuditRow = Extract<AuditExportRow, { kind: 'treatment' }>;
type MaterialCostFilter = 'all' | 'tomorrow' | 'today' | 'custom';

const getTreatmentRecordIds = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
  const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
  return groupedRecords.map((item) => item.id).filter(Boolean);
};

const MaterialCostView: React.FC<MaterialCostViewProps> = ({ records, loading, currency, canManageMaterials, onRefresh }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [showAll, setShowAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [materialFilter, setMaterialFilter] = useState<MaterialCostFilter>('today');
  const [editingRecord, setEditingRecord] = useState<(ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) | null>(null);
  const [materialSummaries, setMaterialSummaries] = useState<Record<string, { auditLogId: string; totalAmount: number; itemCount: number }>>({});
  const todayKey = useMemo(() => toLocalISODate(new Date()), []);
  const tomorrowKey = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toLocalISODate(tomorrow);
  }, []);
  const [dateFrom, setDateFrom] = useState(todayKey);
  const [dateTo, setDateTo] = useState(todayKey);
  const itemsPerPage = 10;

  const treatmentRows = useMemo<TreatmentAuditRow[]>(() => (
    records
      .map((record) => ({
        kind: 'treatment' as const,
        sortDate: `${record.date || ''}T23:59:59`,
        record
      }))
      .sort((a, b) => b.sortDate.localeCompare(a.sortDate))
  ), [records]);

  const baseFilteredRows = useMemo(() => {
    return filterAuditLogRowsForExport(treatmentRows, {
      auditFilter: 'treatments',
      dateFrom,
      dateTo,
      searchTerm
    }) as TreatmentAuditRow[];
  }, [treatmentRows, dateFrom, dateTo, searchTerm]);

  const loadMaterialSummaries = React.useCallback(async (rowsToLoad: TreatmentAuditRow[]) => {
    const treatmentIds = rowsToLoad.flatMap((row) => getTreatmentRecordIds(row.record));
    if (treatmentIds.length === 0) {
      return;
    }

    try {
      const summaries = await api.materialCosts.getTotalsByTreatmentIds(treatmentIds);
      setMaterialSummaries((current) => {
        const next = { ...current };
        treatmentIds.forEach((treatmentId) => {
          delete next[treatmentId];
        });
        return { ...next, ...summaries };
      });
    } catch (error) {
      console.warn('Unable to refresh material cost summaries. Keeping current table totals.', error);
    }
  }, []);

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
    if (value && (!dateTo || value > dateTo)) setDateTo(value);
    setMaterialFilter('custom');
    setCurrentPage(1);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
    if (value && (!dateFrom || value < dateFrom)) setDateFrom(value);
    setMaterialFilter('custom');
    setCurrentPage(1);
  };

  const renderPatientBalance = (balance?: number | null) => {
    if (balance === null || balance === undefined) return <span className="text-slate-400">-</span>;
    const numericBalance = Number(balance || 0);
    return (
      <span className={numericBalance > 0 ? 'font-bold text-red-600' : 'font-semibold text-green-600'}>
        {numericBalance > 0 ? formatCurrency(numericBalance, currency) : 'Clear'}
      </span>
    );
  };

  const renderTreatmentDescriptionList = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return (
      <div className="space-y-1">
        {groupedRecords.map((item, index) => (
          <div key={`${item.id || index}-${index}`} className="flex min-w-0 items-start gap-1.5">
            <span className="mt-0.5 shrink-0 text-green-600">&bull;</span>
            <span className="min-w-0 break-words">{item.description || 'Treatment record'}</span>
          </div>
        ))}
      </div>
    );
  };

  const getMaterialTotal = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    return getTreatmentRecordIds(record).reduce((sum, treatmentId) => {
      return sum + Number(materialSummaries[treatmentId]?.totalAmount || 0);
    }, 0);
  };

  const getTreatmentAmount = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return groupedRecords.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  };

  const getAdjustedDoctorEarned = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return calculateMaterialAdjustedDoctorEarnings(
      groupedRecords,
      (treatmentId) => Number(materialSummaries[treatmentId]?.totalAmount || 0)
    );
  };

  const getNetProfit = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
    return calculateMaterialNetProfit(
      groupedRecords,
      (treatmentId) => Number(materialSummaries[treatmentId]?.totalAmount || 0)
    );
  };

  const statusFilteredRows = baseFilteredRows;

  const paginatedRows = useMemo(() => {
    if (showAll) return statusFilteredRows;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return statusFilteredRows.slice(startIndex, startIndex + itemsPerPage);
  }, [statusFilteredRows, currentPage, showAll]);

  React.useEffect(() => {
    if (loading) return;
    void loadMaterialSummaries(paginatedRows);
  }, [loading, loadMaterialSummaries, paginatedRows]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [records, searchTerm, dateFrom, dateTo, materialFilter]);

  const renderMaterialCost = (record: ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) => {
    const totalAmount = getMaterialTotal(record);
    if (totalAmount <= 0) return <span className="text-slate-400">-</span>;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hover-100)] bg-[var(--hover-50)] px-2.5 py-1 text-xs font-black text-[var(--hover-700)]">
        <Package size={13} />
        {formatCurrency(totalAmount, currency)}
      </span>
    );
  };

  const handleMaterialSaved = async (summary: { treatmentId: string; auditLogId: string; totalAmount: number; itemCount: number }) => {
    setMaterialSummaries((current) => {
      const next = { ...current };
      if (summary.itemCount > 0 && summary.totalAmount > 0) {
        next[summary.treatmentId] = {
          auditLogId: summary.auditLogId,
          totalAmount: summary.totalAmount,
          itemCount: summary.itemCount
        };
      } else {
        delete next[summary.treatmentId];
      }
      return next;
    });
    await onRefresh();
    await loadMaterialSummaries(paginatedRows);
  };

  const materialFilterOptions: Array<{ value: MaterialCostFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'tomorrow', label: 'Tomorrow' },
    { value: 'today', label: 'Today' }
  ];
  const handleMaterialFilterChange = (filter: MaterialCostFilter) => {
    setMaterialFilter(filter);
    if (filter === 'all') {
      setDateFrom('');
      setDateTo('');
    } else {
      const selectedDate = filter === 'tomorrow' ? tomorrowKey : todayKey;
      setDateFrom(selectedDate);
      setDateTo(selectedDate);
    }
    setCurrentPage(1);
  };
  const isTodayRange = dateFrom === todayKey && dateTo === todayKey;

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm animate-fade-in">
      <div className="border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-[var(--hover-50)]/40">
        <div className="flex min-w-0 flex-col gap-4 p-3 sm:p-4 md:p-6 xl:flex-row xl:items-start xl:justify-between xl:gap-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="hidden h-11 w-11 items-center justify-center rounded-2xl border theme-accent-border theme-accent-soft-bg theme-accent-text sm:flex">
              <Package size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] theme-accent-text sm:text-[11px] sm:tracking-[0.24em]">Service Menu</p>
              <h2 className="break-words text-xl font-bold text-slate-900 sm:text-2xl">Material Cost</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 sm:text-sm">
                Track material costs against completed treatment rows.
              </p>
              <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 text-xs sm:flex-wrap sm:overflow-visible sm:pb-0">
                <span className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700">
                  {statusFilteredRows.length} visible
                </span>
                <span className="shrink-0 rounded-full border theme-accent-border theme-accent-soft-bg px-3 py-1 font-semibold theme-accent-text">
                  {baseFilteredRows.length} treatments
                </span>
              </div>
            </div>
          </div>

          <div className="w-full min-w-0 space-y-3 xl:max-w-5xl">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <div className="min-w-0">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(event) => handleDateFromChange(event.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)] min-[380px]:text-sm sm:w-36 sm:px-3"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(event) => handleDateToChange(event.target.value)}
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-xs text-slate-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)] min-[380px]:text-sm sm:w-36 sm:px-3"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDateFrom(todayKey);
                      setDateTo(todayKey);
                      setMaterialFilter('today');
                      setCurrentPage(1);
                    }}
                    title={isTodayRange ? 'Showing today only' : 'Custom date range selected. Click to reset to today.'}
                    className={`col-span-2 min-h-10 w-full self-end rounded-xl border px-4 py-2.5 text-xs font-bold transition-colors sm:col-span-1 sm:w-auto ${
                      isTodayRange
                        ? 'theme-accent-border theme-accent-soft-bg theme-accent-text'
                        : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    }`}
                  >
                    {isTodayRange ? 'Today' : 'Custom'}
                  </button>
                </div>
                <div className="grid w-full grid-cols-3 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:inline-grid sm:w-auto">
                  {materialFilterOptions.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleMaterialFilterChange(item.value)}
                      className={`rounded-lg px-2 py-2 text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)] sm:px-3.5 ${
                        materialFilter === item.value
                          ? 'bg-white font-bold theme-accent-text shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full min-w-0 lg:max-w-md">
                <input
                  type="text"
                  placeholder="Search patient, doctor, service..."
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)]"
                />
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
              <button
                type="button"
                onClick={() => void onRefresh()}
                className="refresh-action-button flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[var(--hover-300)] sm:px-4"
              >
                <RotateCw size={16} className="refresh-action-icon" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 p-12 text-slate-500">
          <Loader2 className="animate-spin text-[var(--hover-600)]" />
          <p className="text-sm font-medium">Loading material cost rows...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Date / Time</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Patient</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Clinician</th>
                <th className="px-6 py-4 text-left text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Clinical Activity</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Patient Balance</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Treatment Amount</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Material Cost</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Doctor Earned</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Net Profit</th>
                <th className="px-6 py-4 text-right text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {statusFilteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                      <p className="text-sm font-semibold text-slate-600">No treatment rows found</p>
                      <p className="mt-1 text-xs text-slate-400">Try another date range or clear the search field.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const record = row.record;
                  const treatmentAmount = getTreatmentAmount(record);
                  const adjustedDoctorEarned = getAdjustedDoctorEarned(record);
                  const netProfit = getNetProfit(record);
                  return (
                    <tr key={`material-cost-${record.id}`} className="border-l-4 border-[var(--hover-300)] transition-colors hover:bg-[var(--hover-50)]/30">
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500 xl:px-6">{record.date}</td>
                      <td className="px-4 py-4 font-bold text-slate-900 xl:px-6">{record.patient_name || 'Unknown'}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 xl:px-6">{formatDoctorName(record.doctor_name)}</td>
                      <td className="max-w-md px-4 py-4 text-sm text-slate-700 xl:px-6">
                        {renderTreatmentDescriptionList(record)}
                        <span className="mt-1 block text-xs font-mono text-gray-500">
                          {record.teeth && record.teeth.length > 0 ? formatTeethWithPosition(record.teeth) : 'General'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-sm xl:px-6">{renderPatientBalance(record.patient_balance)}</td>
                      <td className="px-4 py-4 text-right text-sm font-black text-slate-900 xl:px-6">{formatCurrency(treatmentAmount, currency)}</td>
                      <td className="px-4 py-4 text-right text-sm font-bold xl:px-6">{renderMaterialCost(record)}</td>
                      <td className="px-4 py-4 text-right text-sm font-bold text-emerald-700 xl:px-6">{adjustedDoctorEarned > 0 ? formatCurrency(adjustedDoctorEarned, currency) : '-'}</td>
                      <td className={`px-4 py-4 text-right text-sm font-black xl:px-6 ${netProfit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{formatCurrency(netProfit, currency)}</td>
                      <td className="px-4 py-4 text-right xl:px-6">
                        {canManageMaterials ? (
                          <button
                            type="button"
                            onClick={() => setEditingRecord(record)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--hover-200)] bg-[var(--hover-50)] px-3 py-1.5 text-xs font-bold text-[var(--hover-700)] hover:bg-[var(--hover-100)]"
                          >
                            <Package size={13} />
                            <Plus size={12} />
                            Material
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">No access</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && statusFilteredRows.length > 0 && (
        <Pagination
          totalItems={statusFilteredRows.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          showAll={showAll}
          onToggleShowAll={() => setShowAll(!showAll)}
        />
      )}

      <MaterialCostModal
        isOpen={!!editingRecord}
        record={editingRecord}
        currency={currency}
        onClose={() => setEditingRecord(null)}
        onSaved={handleMaterialSaved}
      />
    </div>
  );
};

export default MaterialCostView;
