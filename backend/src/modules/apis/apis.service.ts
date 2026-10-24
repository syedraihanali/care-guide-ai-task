import type { AlertSeverity, CheckSeverity, IssueType, Metrics } from '../../domain/monitoring.js';
import { Alert } from '../../models/alert.model.js';
import { ApiCheck } from '../../models/apiCheck.model.js';

export interface ApiStatus {
  apiName: string;
  healthy: boolean;
  severity: CheckSeverity;
  metrics: Metrics;
  issueTypes: IssueType[];
  checkedAt: Date;
  activeAlert: { id: string; severity: AlertSeverity } | null;
}

interface LatestCheckRow {
  _id: string;
  latest: { healthy: boolean; severity: CheckSeverity; metrics: Metrics; issueTypes: IssueType[]; checkedAt: Date };
  activeAlerts: Array<{ _id: unknown; severity: AlertSeverity }>;
}

/** The latest check of every API, plus its active alert if it has one. */
export async function getApiStatuses(): Promise<ApiStatus[]> {
  const rows = await ApiCheck.aggregate<LatestCheckRow>([
    // Newest first per API (served by the apiName/checkedAt/_id index), then keep the first of each API.
    { $sort: { apiName: 1, checkedAt: -1, _id: -1 } },
    { $group: { _id: '$apiName', latest: { $first: '$$ROOT' } } },
    {
      $lookup: {
        from: Alert.collection.name,
        localField: '_id',
        foreignField: 'apiName',
        pipeline: [{ $match: { status: 'active' } }, { $project: { severity: 1 } }],
        as: 'activeAlerts',
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return rows.map(({ _id: apiName, latest, activeAlerts: [activeAlert] }) => ({
    apiName,
    healthy: latest.healthy,
    severity: latest.severity,
    metrics: latest.metrics,
    issueTypes: latest.issueTypes,
    checkedAt: latest.checkedAt,
    activeAlert: activeAlert ? { id: String(activeAlert._id), severity: activeAlert.severity } : null,
  }));
}
