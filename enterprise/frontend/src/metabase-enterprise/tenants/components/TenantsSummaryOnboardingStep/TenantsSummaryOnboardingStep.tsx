import { useMemo } from "react";
import { push } from "react-router-redux";
import { t } from "ttag";

import { RelatedSettingCard } from "metabase/admin/components/RelatedSettingsSection";
import type { DataSegregationStrategy } from "metabase/embedding/embedding-hub";
import { useDispatch } from "metabase/lib/redux";
import type { CreatedTenantData } from "metabase/plugins/oss/tenants";
import { Button, Flex, SimpleGrid, Stack, Text, Title } from "metabase/ui";
import type { FieldId } from "metabase-types/api";

import { useListTenantsQuery } from "../../../api/tenants";
import { getIsolationFieldConfig } from "../CreateTenantsOnboardingStep/isolation-field-config";

import { TenantSummaryCard } from "./TenantSummaryCard";
import { useRlsFieldsInfo } from "./hooks/use-rls-fields-info";

/**
 * If the user has reloaded the page, we fetch the
 * latest tenants to show as a fallback.
 */
const MAX_FETCHED_TENANTS_TO_SHOW = 3;

const ISOLATION_ATTRIBUTE_KEYS = [
  "tenant_identifier",
  "database_role",
  "database_slug",
] as const;

export const TenantsSummaryOnboardingStep = ({
  tenants,
  strategy,
  selectedFieldIds = [],
}: {
  tenants: CreatedTenantData[];
  strategy?: DataSegregationStrategy | null;
  selectedFieldIds?: FieldId[];
}) => {
  const dispatch = useDispatch();

  const { data: tenantsData } = useListTenantsQuery(
    { status: "active" },
    { skip: tenants.length > 0 },
  );

  const onDone = () => dispatch(push("/admin/embedding/setup-guide"));

  const tenantsToShow = useMemo(() => {
    // If we have tenants from the flow, use them
    if (tenants.length > 0) {
      return tenants;
    }

    // Fallback to the last N tenants (most recently created are likely at the end)
    const lastTenants =
      tenantsData?.data?.slice(-MAX_FETCHED_TENANTS_TO_SHOW) ?? [];

    return lastTenants.map((tenant) => {
      // Detect which isolation attribute is set on the tenant
      const dataIsolationFieldKey = ISOLATION_ATTRIBUTE_KEYS.find(
        (key) => tenant.attributes?.[key] != null,
      );

      return {
        name: tenant.name,
        slug: tenant.slug,
        dataIsolationFieldValue:
          tenant.attributes?.[dataIsolationFieldKey ?? ""] ?? "",
      };
    });
  }, [tenants, tenantsData]);

  const fieldConfig = getIsolationFieldConfig(strategy);

  const {
    tableNames,
    columnName,
    isLoading: isRlsInfoLoading,
  } = useRlsFieldsInfo(
    strategy === "row-column-level-security" ? selectedFieldIds : [],
  );

  return (
    <Stack gap="lg">
      <Title order={3} c="text-primary">
        {t`You created the following tenants`}
      </Title>

      <Stack gap="md">
        {tenantsToShow.map((tenant) => (
          <TenantSummaryCard
            key={tenant.slug}
            name={tenant.name}
            isolationFieldLabel={
              tenant.dataIsolationFieldValue
                ? (fieldConfig?.label ?? null)
                : null
            }
            isolationFieldValue={tenant.dataIsolationFieldValue || null}
            slug={tenant.slug}
            dataPermissionsDescription={
              isRlsInfoLoading
                ? null
                : getDataPermissionsDescription({
                    strategy,
                    tenantName: tenant.name,
                    tenantValue: tenant.dataIsolationFieldValue,
                    tableNames,
                    columnName,
                  })
            }
          />
        ))}
      </Stack>

      <Text c="text-secondary" lh="lg">
        {t`If you need to change these settings, you can go back to the previous steps, or configure more details in the following pages.`}
      </Text>

      <RelatedSettingsSection />

      <Flex justify="flex-end">
        <Button variant="filled" onClick={onDone}>
          {t`Done`}
        </Button>
      </Flex>
    </Stack>
  );
};

const RelatedSettingsSection = () => (
  <SimpleGrid cols={2} spacing="md">
    <RelatedSettingCard
      name={t`Tenants`}
      icon="globe"
      to="/admin/people/tenants"
    />

    <RelatedSettingCard
      name={t`People`}
      icon="person"
      to="/admin/people/tenants/people"
    />

    <RelatedSettingCard
      name={t`Authentication`}
      icon="lock"
      to="/admin/settings/authentication"
    />

    <RelatedSettingCard
      name={t`Permissions`}
      icon="group"
      to="/admin/permissions"
    />
  </SimpleGrid>
);

function getDataPermissionsDescription({
  strategy,
  tenantName,
  tenantValue,
  tableNames,
  columnName,
}: {
  strategy: DataSegregationStrategy | null | undefined;
  tenantName: string;
  tenantValue: string;
  tableNames: string[];
  columnName: string | null;
}): string | null {
  if (!tenantValue) {
    return null;
  }

  if (strategy === "row-column-level-security") {
    if (tableNames.length === 0 || !columnName) {
      return null;
    }

    const tableList =
      tableNames.length === 1
        ? tableNames[0]
        : `${tableNames.slice(0, -1).join(", ")} ${t`and`} ${tableNames[tableNames.length - 1]}`;

    return t`All users in ${tenantName} can view rows in the ${tableList} tables where ${columnName} field equals ${tenantValue}.`;
  }

  if (strategy === "connection-impersonation") {
    return t`All users in ${tenantName} will connect using the ${tenantValue} database role.`;
  }

  if (strategy === "database-routing") {
    return t`All users in ${tenantName} will be routed to the ${tenantValue} database.`;
  }

  return null;
}
