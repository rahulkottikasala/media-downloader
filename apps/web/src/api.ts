import type {
  MediaMetadata,
  CreateJobInput,
  JobPublicDto,
  HealthResponse,
} from '@mediaflow/shared';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export function getApiBaseUrl(): string {
  return API_BASE;
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.statusText}`);
  }
  return res.json();
}

export async function inspectMediaUrl(url: string): Promise<MediaMetadata> {
  const res = await fetch(`${API_BASE}/media/inspect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await res.json();
  if (!res.ok && !data.error) {
    throw new Error(`Failed to inspect media (${res.status})`);
  }
  return data;
}

export async function uploadLocalMedia(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ uploadId: string; metadata: MediaMetadata }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${API_BASE}/media/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (err) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.error || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during file upload'));
    };

    xhr.send(formData);
  });
}

export async function createJob(input: CreateJobInput): Promise<JobPublicDto> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to create job (${res.status})`);
  }

  return res.json();
}

export async function getJob(id: string, token?: string): Promise<JobPublicDto> {
  const url = token ? `${API_BASE}/jobs/${id}?token=${encodeURIComponent(token)}` : `${API_BASE}/jobs/${id}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch job (${res.status})`);
  }
  return res.json();
}

export async function cancelJob(id: string, token?: string): Promise<void> {
  const url = token ? `${API_BASE}/jobs/${id}?token=${encodeURIComponent(token)}` : `${API_BASE}/jobs/${id}`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to cancel job');
  }
}

export function getDownloadUrl(jobId: string, token: string): string {
  return `${API_BASE}/jobs/${jobId}/download?token=${encodeURIComponent(token)}`;
}

export async function exportBatchZip(jobIds: string[]): Promise<Blob> {
  const res = await fetch(`${API_BASE}/jobs/batch-zip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobIds }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate batch zip');
  }

  return res.blob();
}
