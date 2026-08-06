import type {
  ApiResponse, PaginatedData,
  OccupationItem, OccupationDetail, CreateOccupationBody, OccupationMutationResult,
  AbilityItem, AbilityDetail, CreateAbilityBody, AbilityMutationResult, AbilityReviewResult,
  OccupationFamilyItem, OccupationFamilyDetail, CreateOccupationFamilyBody, OccupationFamilyMutationResult, OccupationFamilyReviewResult,
  MajorItem, MajorDetail, CreateMajorBody, MajorMutationResult, MajorReviewResult,
  ReviewBody,
} from "../types/api";

const BASE = "/api/dict";
const hdrs = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("baigon_token")}`,
});

async function request<T>(url: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.detail?.[0]?.msg || `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return res.json();
}


export async function getOccupationList(page = 1, page_size = 20) {
  return request<PaginatedData<OccupationItem>>(`${BASE}/occupations?page=${page}&page_size=${page_size}`, { headers: hdrs() });
}
export async function createOccupation(body: CreateOccupationBody) {
  return request<OccupationMutationResult>(`${BASE}/occupations`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}
export async function getOccupationDetail(occupation_id: string) {
  return request<OccupationDetail>(`${BASE}/occupations/${occupation_id}`, { headers: hdrs() });
}
export async function updateOccupation(occupation_id: string, body: CreateOccupationBody) {
  return request<OccupationMutationResult>(`${BASE}/occupations/${occupation_id}`, { method: "PUT", headers: hdrs(), body: JSON.stringify(body) });
}
export async function deleteOccupation(occupation_id: string) {
  return request<string>(`${BASE}/occupations/${occupation_id}`, { method: "DELETE", headers: hdrs() });
}
export async function reviewOccupation(occupation_id: string, body: ReviewBody) {
  return request<OccupationMutationResult>(`${BASE}/occupations/${occupation_id}/review`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}


export async function getAbilityList(page = 1, page_size = 20) {
  return request<PaginatedData<AbilityItem>>(`${BASE}/abilities?page=${page}&page_size=${page_size}`, { headers: hdrs() });
}
export async function createAbility(body: CreateAbilityBody) {
  return request<AbilityMutationResult>(`${BASE}/abilities`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}
export async function getAbilityDetail(ability_id: string) {
  return request<AbilityDetail>(`${BASE}/abilities/${ability_id}`, { headers: hdrs() });
}
export async function updateAbility(ability_id: string, body: CreateAbilityBody) {
  return request<AbilityMutationResult>(`${BASE}/abilities/${ability_id}`, { method: "PUT", headers: hdrs(), body: JSON.stringify(body) });
}
export async function deleteAbility(ability_id: string) {
  return request<string>(`${BASE}/abilities/${ability_id}`, { method: "DELETE", headers: hdrs() });
}
export async function reviewAbility(ability_id: string, body: ReviewBody) {
  return request<AbilityReviewResult>(`${BASE}/abilities/${ability_id}/review`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}


export async function getOccupationFamilyList(page = 1, page_size = 20) {
  return request<PaginatedData<OccupationFamilyItem>>(`${BASE}/occupation_families?page=${page}&page_size=${page_size}`, { headers: hdrs() });
}
export async function createOccupationFamily(body: CreateOccupationFamilyBody) {
  return request<OccupationFamilyMutationResult>(`${BASE}/occupation_families`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}
export async function getOccupationFamilyDetail(family_id: string) {
  return request<OccupationFamilyDetail>(`${BASE}/occupation_families/${family_id}`, { headers: hdrs() });
}
export async function updateOccupationFamily(family_id: string, body: CreateOccupationFamilyBody) {
  return request<OccupationFamilyMutationResult>(`${BASE}/occupation_families/${family_id}`, { method: "PUT", headers: hdrs(), body: JSON.stringify(body) });
}
export async function deleteOccupationFamily(family_id: string) {
  return request<string>(`${BASE}/occupation_families/${family_id}`, { method: "DELETE", headers: hdrs() });
}
export async function reviewOccupationFamily(family_id: string, body: ReviewBody) {
  return request<OccupationFamilyReviewResult>(`${BASE}/occupation_families/${family_id}/review`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}

// ═══════ 标准产业 majors ═══════

export async function getMajorList(page = 1, page_size = 20) {
  return request<PaginatedData<MajorItem>>(`${BASE}/majors?page=${page}&page_size=${page_size}`, { headers: hdrs() });
}
export async function createMajor(body: CreateMajorBody) {
  return request<MajorMutationResult>(`${BASE}/majors`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}
export async function getMajorDetail(major_id: string) {
  return request<MajorDetail>(`${BASE}/majors/${major_id}`, { headers: hdrs() });
}
export async function updateMajor(major_id: string, body: CreateMajorBody) {
  return request<MajorMutationResult>(`${BASE}/majors/${major_id}`, { method: "PUT", headers: hdrs(), body: JSON.stringify(body) });
}
export async function deleteMajor(major_id: string) {
  return request<string>(`${BASE}/majors/${major_id}`, { method: "DELETE", headers: hdrs() });
}
export async function reviewMajor(major_id: string, body: ReviewBody) {
  return request<MajorReviewResult>(`${BASE}/majors/${major_id}/review`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
}


import { taxonomyTree } from "../data";

export async function getTaxonomy() {
  return Promise.resolve({
    code: 0, message: "success",
    data: { data: { children: taxonomyTree } },
  });
}
