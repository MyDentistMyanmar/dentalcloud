import React from 'react';
import { Loader2, Package, Plus, Trash2 } from 'lucide-react';
import type { ClinicalRecord, PatientMaterialCostInput } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';
import { formatCurrency, type Currency } from '../utils/currency';
import { formatDoctorName } from '../utils/doctorName';
import { Modal } from './Shared';

interface MaterialCostModalProps {
  isOpen: boolean;
  record: (ClinicalRecord & { _groupedRecords?: ClinicalRecord[] }) | null;
  currency: Currency;
  onClose: () => void;
  onSaved: (summary: { treatmentId: string; auditLogId: string; totalAmount: number; itemCount: number }) => void | Promise<void>;
}

type MaterialCostDraft = PatientMaterialCostInput & { localId: string };

const createEmptyDraft = (): MaterialCostDraft => ({
  localId: `material-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  materialName: '',
  costAmount: 0,
  quantity: 1
});

const getRecordActivity = (record: MaterialCostModalProps['record']): string => {
  if (!record) return '-';
  const groupedRecords = record._groupedRecords?.length ? record._groupedRecords : [record];
  return groupedRecords
    .map((item) => item.description)
    .filter(Boolean)
    .join(' + ') || 'Treatment record';
};

const MaterialCostModal: React.FC<MaterialCostModalProps> = ({ isOpen, record, currency, onClose, onSaved }) => {
  const [items, setItems] = React.useState<MaterialCostDraft[]>([createEmptyDraft()]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen || !record) return;

    let cancelled = false;
    setLoading(true);
    setSaving(false);
    setError(null);

    api.materialCosts.getByTreatmentId(record.id)
      .then(({ items: existingItems }) => {
        if (cancelled) return;
        setItems(existingItems.length > 0
          ? existingItems.map((item) => ({
              localId: item.id,
              materialName: item.materialName,
              costAmount: item.costAmount,
              quantity: item.quantity
            }))
          : [createEmptyDraft()]
        );
      })
      .catch((err: any) => {
        if (!cancelled) {
          setError(err?.message || 'Failed to load material costs.');
          setItems([createEmptyDraft()]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, record]);

  if (!isOpen || !record) return null;

  const updateItem = (localId: string, patch: Partial<MaterialCostDraft>) => {
    setItems((current) => current.map((item) => (
      item.localId === localId ? { ...item, ...patch } : item
    )));
  };

  const removeItem = (localId: string) => {
    setItems((current) => current.length === 1 ? [createEmptyDraft()] : current.filter((item) => item.localId !== localId));
  };

  const visibleItems = items.filter((item) => (
    item.materialName.trim() || item.costAmount > 0 || item.quantity !== 1
  ));
  const totalAmount = visibleItems.reduce((sum, item) => {
    const cost = Number(item.costAmount || 0);
    const quantity = Number(item.quantity || 0);
    return sum + (Number.isFinite(cost) && Number.isFinite(quantity) ? cost * quantity : 0);
  }, 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const session = auth.getSession();
      if (!session?.userId || session.role !== 'admin') {
        throw new Error('You do not have permission to update material costs.');
      }

      const incompleteItem = visibleItems.find((item) => (
        !item.materialName.trim() || Number(item.costAmount) <= 0 || Number(item.quantity) <= 0
      ));
      if (incompleteItem) {
        throw new Error('Each material needs a name, a cost greater than zero, and a quantity greater than zero.');
      }

      const cleanedItems = visibleItems
        .filter((item) => item.materialName.trim())
        .map((item) => ({
          materialName: item.materialName,
          costAmount: Number(item.costAmount || 0),
          quantity: Number(item.quantity || 0)
        }));

      const result = await api.materialCosts.upsertForTreatment(record, cleanedItems, {
        userId: session.userId,
        username: session.username
      });
      await onSaved({
        treatmentId: record.id,
        auditLogId: result.auditLogId,
        totalAmount: result.items.reduce((sum, item) => sum + item.totalAmount, 0),
        itemCount: result.items.length
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save material costs.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Material Cost" onClose={onClose} maxWidthClassName="max-w-4xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-3 rounded-2xl border border-[var(--hover-100)] bg-[var(--hover-50)]/70 p-4 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--hover-700)]">Patient</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{record.patient_name || 'Unknown'}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--hover-700)]">Clinician</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{formatDoctorName(record.doctor_name)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--hover-700)]">Clinical Activity</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{getRecordActivity(record)}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-sm font-semibold text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading material costs...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="hidden grid-cols-[1fr_140px_120px_44px] gap-3 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 sm:grid">
              <span>Material Name</span>
              <span>Cost</span>
              <span>Quantity</span>
              <span />
            </div>

            {items.map((item, index) => (
              <div key={item.localId} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[1fr_140px_120px_44px] sm:items-center">
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500 sm:hidden">Material Name</label>
                  <input
                    type="text"
                    value={item.materialName}
                    onChange={(event) => updateItem(item.localId, { materialName: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--hover-500)] focus:ring-4 focus:ring-[var(--hover-100)]"
                    placeholder={`Material ${index + 1}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500 sm:hidden">Cost</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.costAmount || ''}
                    onChange={(event) => updateItem(item.localId, { costAmount: Number(event.target.value || 0) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--hover-500)] focus:ring-4 focus:ring-[var(--hover-100)]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-500 sm:hidden">Quantity</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity || ''}
                    onChange={(event) => updateItem(item.localId, { quantity: Number(event.target.value || 0) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[var(--hover-500)] focus:ring-4 focus:ring-[var(--hover-100)]"
                    placeholder="1"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.localId)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100 sm:w-11"
                  aria-label="Remove material cost row"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setItems((current) => [...current, createEmptyDraft()])}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--hover-200)] bg-[var(--hover-50)] px-4 py-2.5 text-sm font-bold text-[var(--hover-700)] transition hover:bg-[var(--hover-100)]"
            >
              <Plus size={16} />
              Add Material
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Package size={17} className="text-[var(--hover-600)]" />
            Material total
          </div>
          <p className="text-xl font-black text-[var(--hover-700)]">{formatCurrency(totalAmount, currency)}</p>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--hover-600)] px-5 py-3 text-sm font-black text-white transition hover:bg-[var(--hover-700)] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
            {saving ? 'Saving...' : 'Save Material'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MaterialCostModal;
