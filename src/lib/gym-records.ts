import { getSupabaseAdminClient } from "@/lib/supabase";

export type GymRecordRow = {
  id: string;
  gym_id: string;
  collection_name: string;
  payload: Record<string, unknown>;
  phone_normalized: string | null;
  created_at: string;
  updated_at: string;
};

export async function listGymRecords(gymId: string, collection: string, limit = 500) {
  const { data, error } = await getSupabaseAdminClient()
    .from("gym_records")
    .select("id,payload,created_at,updated_at,phone_normalized")
    .eq("gym_id", gymId)
    .eq("collection_name", collection)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((record) => ({ ...record.payload, id: record.id }));
}

export async function getGymRecord(gymId: string, collection: string, id: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("gym_records")
    .select("id,gym_id,collection_name,payload,phone_normalized,created_at,updated_at")
    .eq("gym_id", gymId)
    .eq("collection_name", collection)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as GymRecordRow | null;
}

export async function insertGymRecord(
  gymId: string,
  collection: string,
  payload: Record<string, unknown>,
  options: { id?: string; phoneNormalized?: string | null } = {},
) {
  const id = options.id ?? (typeof payload.id === "string" ? payload.id : crypto.randomUUID());
  const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : new Date().toISOString();
  const { error } = await getSupabaseAdminClient().from("gym_records").insert({
    id,
    gym_id: gymId,
    collection_name: collection,
    payload: { ...payload, id },
    phone_normalized: options.phoneNormalized ?? null,
    created_at: createdAt,
    updated_at: typeof payload.updatedAt === "string" ? payload.updatedAt : createdAt,
  });
  if (error) throw error;
  return { ...payload, id };
}

export async function updateGymRecord(
  gymId: string,
  collection: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await getSupabaseAdminClient()
    .from("gym_records")
    .update({
      payload: { ...payload, id },
      updated_at: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
    })
    .eq("gym_id", gymId)
    .eq("collection_name", collection)
    .eq("id", id)
    .select("id,payload")
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data.payload, id: data.id } : null;
}

export async function deleteGymRecord(gymId: string, collection: string, id: string) {
  const { data, error } = await getSupabaseAdminClient()
    .from("gym_records")
    .delete()
    .eq("gym_id", gymId)
    .eq("collection_name", collection)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
