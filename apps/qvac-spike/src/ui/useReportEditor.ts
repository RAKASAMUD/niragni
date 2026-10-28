/**
 * Report editor state + serialized autosave.
 *
 * Correctness rules enforced here (from the product plan, contract, and
 * coordinator source reviews):
 * - saveReport takes the report WITH its expected revision; a stale write
 *   rejects. On success the store returns the incremented revision, which we
 *   adopt as the new base.
 * - Saves are SERIALIZED via a single in-flight promise; the latest edit is
 *   coalesced and saved after the current save resolves.
 * - On a FAILED save the dirty flags are RESTORED (so the unsaved edit is not
 *   silently forgotten) and the error is preserved. `flush()` then re-attempts
 *   the dirty save and REJECTS if it still fails, so navigation / photo / AI
 *   callers stay put and surface the error instead of proceeding on an unsaved
 *   report.
 * - `reload()` / `setReport()` never clobber local state while ANYTHING is
 *   unsaved — dirty OR an in-flight/queued save.
 * - A queued saver from an OLD generation/id checks the generation token BEFORE
 *   it reads `latestRef` or calls the store, so it can never write a new
 *   report's state under a previous report's queue.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { services, Report } from './services';

export type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'failed';

export interface ReportEditor {
  readonly report: Report | null;
  readonly saveState: SaveState;
  readonly errorMessage: string | null;
  /** True when there is an unsaved edit OR an in-flight/queued save. */
  readonly isDirty: boolean;
  /** Apply a local field change; schedules a serialized autosave. */
  update: (patch: Partial<Report>) => void;
  /** Replace the whole report locally (e.g. after reload), keeping edits safe. */
  setReport: (next: Report) => void;
  /**
   * Force any pending edit to be saved now and resolve with the stored report.
   * REJECTS if the final save failed — callers must handle it (stay/show error).
   */
  flush: () => Promise<Report>;
  /** Reload from the store; never replaces unsaved/pending local edits. */
  reload: () => Promise<Report | null>;
}

export function useReportEditor(reportId: string | undefined): ReportEditor {
  const [report, setReportState] = useState<Report | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Newest local report; the serialized saver always persists this, never a
  // captured-stale closure value.
  const latestRef = useRef<Report | null>(null);
  // Shared promise for the current save chain; flush() awaits it.
  const saveChainRef = useRef<Promise<Report> | null>(null);
  // There is an edit that still needs to be persisted (set on edit, cleared
  // only after a pass that actually committed it; restored on failure).
  const dirtyRef = useRef(false);
  const mountedRef = useRef(true);
  // Generation token: bumped whenever reportId changes, so late loads/saves for
  // a previous id are ignored even though the hook instance is still mounted.
  const genRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const alive = (gen: number) => mountedRef.current && gen === genRef.current;

  const markDirty = (v: boolean) => { dirtyRef.current = v; };
  /** True when anything still needs persisting or is being persisted. */
  const hasPendingWork = () => dirtyRef.current || saveChainRef.current !== null;

  // Load (or reset) when the report id changes.
  useEffect(() => {
    genRef.current += 1;
    const gen = genRef.current;
    latestRef.current = null;
    saveChainRef.current = null;
    dirtyRef.current = false;
    setIsDirty(false);
    setReportState(null);
    setErrorMessage(null);
    setSaveState('idle');

    if (!reportId) return;
    (async () => {
      try {
        const r = await services.getReport(reportId);
        if (!alive(gen)) return;
        if (r && !dirtyRef.current && saveChainRef.current === null) {
          latestRef.current = r;
          setReportState(r);
          setSaveState('saved');
        }
      } catch (e) {
        if (!alive(gen)) return;
        setErrorMessage(e instanceof Error ? e.message : String(e));
        setSaveState('failed');
      }
    })();
  }, [reportId]);

  // One save pass: persist latestRef, adopt the authoritative revision, and
  // preserve any edits made DURING the save. Returns the stored/merged report
  // or throws on failure. Caller (the chain runner) owns dirty-flag handling.
  const savePass = useCallback(async (gen: number): Promise<Report> => {
    // Generation/id check BEFORE reading latestRef so an old queue cannot read
    // or write the new report's state.
    if (gen !== genRef.current) {
      throw new Error('__stale_generation__');
    }
    const toSave = latestRef.current;
    if (!toSave) throw new Error('Tidak ada draf untuk disimpan.');
    if (alive(gen)) setSaveState('saving');
    const stored = await services.saveReport(toSave);
    if (gen !== genRef.current) {
      // Report id changed while the store call was in flight: abandon the result
      // without touching the new generation's state.
      throw new Error('__stale_generation__');
    }
    const newer = latestRef.current;
    const merged: Report =
      newer && newer !== toSave
        ? { ...newer, id: stored.id, revision: stored.revision, updatedAt: stored.updatedAt }
        : stored;
    latestRef.current = merged;
    if (mountedRef.current) setReportState(merged);
    return merged;
  }, []);

  // Serialized runner: coalesce edits into the shared save chain.
  const scheduleSave = useCallback((gen: number): Promise<Report> => {
    const run = async (): Promise<Report> => {
      let result: Report | null = null;
      // Keep saving while edits keep arriving (dirty), one at a time.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (gen !== genRef.current) throw new Error('__stale_generation__');
        // Clear dirty for THIS attempt; a failure below restores it.
        dirtyRef.current = false;
        try {
          result = await savePass(gen);
        } catch (e) {
          // The edit was NOT persisted — restore the dirty flag so flush() and
          // future edits know work remains, unless this is a stale-generation
          // abandonment (a different report now owns the state).
          if ((e as Error)?.message !== '__stale_generation__' && gen === genRef.current) {
            dirtyRef.current = true;
          }
          throw e;
        }
        if (!dirtyRef.current) break;
      }
      if (alive(gen)) {
        setIsDirty(false);
        setErrorMessage(null);
        setSaveState('saved');
      }
      return result as Report;
    };

    // Chain after any in-flight save so writes serialize.
    const prev = saveChainRef.current ?? Promise.resolve(null as unknown as Report);
    const next = prev.catch(() => undefined).then(run);
    saveChainRef.current = next;
    next.then(
      () => { if (saveChainRef.current === next) saveChainRef.current = null; },
      (e) => {
        if (saveChainRef.current === next) saveChainRef.current = null;
        if ((e as Error)?.message === '__stale_generation__') return;
        if (alive(gen)) {
          setErrorMessage(e instanceof Error ? e.message : String(e));
          setIsDirty(true); // keep the user aware an edit is still unsaved
          setSaveState('failed');
        }
      },
    );
    return next;
  }, [savePass]);

  const update = useCallback((patch: Partial<Report>) => {
    const base = latestRef.current;
    if (!base) return;
    const gen = genRef.current;
    const nextReport = { ...base, ...patch };
    latestRef.current = nextReport;
    dirtyRef.current = true;
    setReportState(nextReport);
    setIsDirty(true);
    setSaveState('editing');
    void scheduleSave(gen).catch(() => { /* surfaced via saveState/errorMessage */ });
  }, [scheduleSave]);

  const setReport = useCallback((next: Report) => {
    // Never adopt an external report while anything is unsaved or in flight.
    if (hasPendingWork()) return;
    const cur = latestRef.current;
    if (cur && next.revision < cur.revision) return;
    latestRef.current = next;
    setReportState(next);
  }, []);

  const flush = useCallback(async (): Promise<Report> => {
    const gen = genRef.current;
    // Await an in-flight/queued chain first.
    if (saveChainRef.current) {
      try {
        const r = await saveChainRef.current;
        // If that chain finished but a newer dirty edit remains (or it failed
        // and restored dirty), fall through to start a fresh save below.
        if (!dirtyRef.current) return r;
      } catch {
        // Fall through: a dirty edit remains after a failed chain; retry it so
        // flush reflects the ACTUAL latest save outcome rather than a stale one.
      }
    }
    if (dirtyRef.current) {
      // Start (or re-start) a save for the outstanding edit and await it; this
      // rejects if the save fails.
      return scheduleSave(gen);
    }
    const r = latestRef.current;
    if (!r) throw new Error('Tidak ada draf untuk disimpan.');
    return r;
  }, [scheduleSave]);

  const reload = useCallback(async (): Promise<Report | null> => {
    if (!reportId) return null;
    const gen = genRef.current;
    const r = await services.getReport(reportId);
    if (!alive(gen)) return r ?? null;
    // Never replace local state while anything is unsaved or being saved.
    if (r && !hasPendingWork()) setReport(r);
    return r ?? null;
  }, [reportId, setReport]);

  return { report, saveState, errorMessage, isDirty, update, setReport, flush, reload };
}
