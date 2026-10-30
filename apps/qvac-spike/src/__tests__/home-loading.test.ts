import { loadHomeData } from '../ui/loadHomeData';

it('shows saved drafts and stops refreshing while model metadata is still pending', async () => {
  let finishModels!: (value: string[]) => void;
  const models = new Promise<string[]>(resolve => { finishModels = resolve; });
  const events: string[] = [];
  const operation = loadHomeData({
    listReports: async () => ['draft'], listModels: () => models,
  }, {
    reports: rows => events.push(rows[0]), models: rows => events.push(rows[0]),
    reportError: () => events.push('report-error'), modelError: () => events.push('model-error'),
    reportsDone: () => events.push('reports-done'),
  });
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(events).toEqual(['draft', 'reports-done']);
  finishModels(['model']); await operation;
  expect(events).toEqual(['draft', 'reports-done', 'model']);
});

it('keeps drafts available when model listing fails', async () => {
  const events: string[] = [];
  await loadHomeData({ listReports: async () => ['draft'], listModels: async () => { throw Error('busy'); } }, {
    reports: rows => events.push(rows[0]), models: () => events.push('model'),
    reportError: () => events.push('report-error'), modelError: () => events.push('model-error'),
    reportsDone: () => events.push('reports-done'),
  });
  expect(events).toContain('draft');
  expect(events).toContain('model-error');
  expect(events).not.toContain('report-error');
});
