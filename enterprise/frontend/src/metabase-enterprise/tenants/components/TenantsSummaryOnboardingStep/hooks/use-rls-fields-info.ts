import { skipToken, useGetFieldQuery } from "metabase/api";
import type { FieldId } from "metabase-types/api";

/**
 * Fetches field metadata (table name and column name) for up to 5 RLS field IDs.
 *
 * Uses a bounded hook pattern (fixed number of hook calls) to satisfy React's
 * rules of hooks while supporting a variable number of field IDs.
 */
export function useRlsFieldsInfo(fieldIds: FieldId[]) {
  const q0 = useGetFieldQuery(
    fieldIds[0] != null ? { id: fieldIds[0] } : skipToken,
  );
  const q1 = useGetFieldQuery(
    fieldIds[1] != null ? { id: fieldIds[1] } : skipToken,
  );
  const q2 = useGetFieldQuery(
    fieldIds[2] != null ? { id: fieldIds[2] } : skipToken,
  );
  const q3 = useGetFieldQuery(
    fieldIds[3] != null ? { id: fieldIds[3] } : skipToken,
  );
  const q4 = useGetFieldQuery(
    fieldIds[4] != null ? { id: fieldIds[4] } : skipToken,
  );

  const allQueries = [q0, q1, q2, q3, q4].slice(0, fieldIds.length);
  const isLoading = allQueries.some((q) => q.isLoading);
  const fields = allQueries.map((q) => q.data).filter(Boolean);

  const tableNames = fields
    .map((f) => f?.table?.display_name)
    .filter((name): name is string => name != null);

  // All selected fields should filter by the same column concept,
  // so use the first field's display name as the column name.
  const columnName = fields[0]?.display_name ?? null;

  return { tableNames, columnName, isLoading };
}
