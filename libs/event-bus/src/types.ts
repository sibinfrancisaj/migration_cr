export interface CloudEventPayload<T = unknown> {
  id: string;
  source: string;
  type: string;
  subject?: string;
  time: string;
  dataContentType: string;
  data: T;
}

export interface WalEntry {
  event: CloudEventPayload;
  queuedAt: number;
  attempts: number;
}
