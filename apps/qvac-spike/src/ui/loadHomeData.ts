/** Keep the manual report list independent of optional model metadata. */
export async function loadHomeData<R, M>(source: {
  listReports(): Promise<R[]>; listModels(): Promise<M[]>;
}, sink: {
  reports(rows: R[]): void; models(rows: M[]): void;
  reportError(error: unknown): void; modelError(error: unknown): void;
  reportsDone(): void;
}): Promise<void> {
  await Promise.allSettled([
    source.listReports().then(sink.reports).catch(sink.reportError).finally(sink.reportsDone),
    source.listModels().then(sink.models).catch(sink.modelError),
  ]);
}
