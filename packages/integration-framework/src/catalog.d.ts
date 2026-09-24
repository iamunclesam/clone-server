export interface IntegrationCatalogItem {
    id: string;
    name: string;
    category: "Communication" | "Engineering" | "Productivity" | "CRM" | "Finance" | "Storage" | "Analytics" | "Customer support" | "Project management" | "Cloud infrastructure";
    description: string;
    iconUrl: string;
    popular: boolean;
    capabilitiesCount: number;
}
export declare const INITIAL_INTEGRATION_CATALOG: IntegrationCatalogItem[];
//# sourceMappingURL=catalog.d.ts.map