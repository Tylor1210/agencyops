/**
 * api.js — Agency Ops API Client
 * Isolates all fetch() calls from application logic.
 */

const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const API = {
  // ── Users ─────────────────────────────────────────────────
  getUsers:       ()          => request('GET', '/users'),
  createUser:     (body)      => request('POST', '/users', body),
  deleteUser:     (id)        => request('DELETE', `/users/${id}`),

  // ── Agencies [NEW] ────────────────────────────────────────
  getAgencies:    ()          => request('GET', '/agencies'),
  getAgency:      (id)        => request('GET', `/agencies/${id}`),
  createAgency:   (body)      => request('POST', '/agencies', body),
  deleteAgency:   (id)        => request('DELETE', `/agencies/${id}`),

  // ── Service Requests (formerly Bundles) ───────────────────
  getServiceRequests:     ()  => request('GET', '/service_requests'),
  getServiceRequest:      (id)=> request('GET', `/service_requests/${id}`),
  createServiceRequest:   (body) => request('POST', '/service_requests', body),
  updateServiceRequest:   (id, body) => request('PUT', `/service_requests/${id}`, body),
  deleteServiceRequest:   (id) => request('DELETE', `/service_requests/${id}`),
  setServiceRequestStatus:(id, status) => request('PATCH', `/service_requests/${id}/status`, { status }),
  hotSwapServiceRequest:  (id, newCreatorId) =>
                               request('POST', `/service_requests/${id}/route`, { new_creator_id: newCreatorId }),

  // ── Tasks ─────────────────────────────────────────────────
  getTasks:       (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/tasks${qs ? '?' + qs : ''}`);
  },
  getTask:        (id)        => request('GET', `/tasks/${id}`),
  updateTask:     (id, body)  => request('PUT', `/tasks/${id}`, body),
  generateTasks:  (serviceRequestId)  => {
    const qs = serviceRequestId ? `?service_request_id=${serviceRequestId}` : '';
    return request('POST', `/tasks/generate${qs}`);
  },

  // ── Scheduler ─────────────────────────────────────────────
  matchSchedule:  (day, time) => {
    const qs = new URLSearchParams({ day, time }).toString();
    return request('GET', `/scheduler/match?${qs}`);
  },

  // ── Assets ────────────────────────────────────────────────
  getAssets: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', `/assets${qs ? '?' + qs : ''}`);
  },
  createAsset:    (body)      => request('POST', '/assets', body),
  deleteAsset:    (id)        => request('DELETE', `/assets/${id}`),

  // ── Chat Logs [NEW] ───────────────────────────────────────
  getChatLogs:    (agencyId)  => request('GET', `/agencies/${agencyId}/chat_logs`),
  createChatLog:  (agencyId, body) => request('POST', `/agencies/${agencyId}/chat_logs`, body),
};

window.API = API;
