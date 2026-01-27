export interface AzureSubscription {
  id: string;
  name: string;
  state: string;
  isDefault: boolean;
}

export interface AzureResource {
  id: string;
  name: string;
  type: string;
  resourceGroup: string;
  location: string;
  subscriptionId: string;
  subscriptionName?: string;
  tags?: Record<string, string>;
}

export interface AzureResourceRaw {
  id: string;
  name: string;
  type: string;
  resourceGroup: string;
  location: string;
  tags?: Record<string, string>;
}
