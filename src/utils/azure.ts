import { execSync } from "child_process";
import { getPreferenceValues } from "@raycast/api";
import { AzureSubscription, AzureResource, AzureResourceRaw } from "../types";

interface Preferences {
  azureCliPath?: string;
}

const DEFAULT_PATHS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

function getEnv(): NodeJS.ProcessEnv {
  const preferences = getPreferenceValues<Preferences>();
  const customPath = preferences.azureCliPath?.trim();

  let extraPaths = [...DEFAULT_PATHS];
  if (customPath) {
    // Extract directory from the full path if user provided full path to az
    const customDir = customPath.endsWith("/az")
      ? customPath.slice(0, -3)
      : customPath;
    extraPaths = [customDir, ...extraPaths];
  }

  return {
    ...process.env,
    PATH: `${extraPaths.join(":")}:${process.env.PATH || ""}`,
  };
}

function execAzCommand(args: string[]): string {
  const command = `az ${args.join(" ")} --output json`;
  return execSync(command, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    env: getEnv(),
  });
}

export function checkAzureCli(): { installed: boolean; loggedIn: boolean } {
  const env = getEnv();
  try {
    execSync("az --version", { encoding: "utf-8", stdio: "pipe", env });
  } catch {
    return { installed: false, loggedIn: false };
  }

  try {
    execSync("az account show", { encoding: "utf-8", stdio: "pipe", env });
    return { installed: true, loggedIn: true };
  } catch {
    return { installed: true, loggedIn: false };
  }
}

export function getSubscriptions(): AzureSubscription[] {
  const output = execAzCommand(["account", "list"]);
  const subscriptions = JSON.parse(output) as Array<{
    id: string;
    name: string;
    state: string;
    isDefault: boolean;
  }>;

  return subscriptions.map((sub) => ({
    id: sub.id,
    name: sub.name,
    state: sub.state,
    isDefault: sub.isDefault,
  }));
}

export function getResources(
  subscriptionId: string,
  subscriptionName: string,
): AzureResource[] {
  const output = execAzCommand([
    "resource",
    "list",
    "--subscription",
    subscriptionId,
  ]);
  const resources = JSON.parse(output) as AzureResourceRaw[];

  return resources.map((res) => ({
    id: res.id,
    name: res.name,
    type: res.type,
    resourceGroup: res.resourceGroup,
    location: res.location,
    subscriptionId: subscriptionId,
    subscriptionName: subscriptionName,
    tags: res.tags,
  }));
}

export function getAllResources(
  subscriptions: AzureSubscription[],
): AzureResource[] {
  const allResources: AzureResource[] = [];

  for (const sub of subscriptions) {
    try {
      const resources = getResources(sub.id, sub.name);
      allResources.push(...resources);
    } catch {
      // Skip subscriptions that fail to fetch resources
    }
  }

  return allResources;
}

export function getPortalUrl(resourceId: string): string {
  return `https://portal.azure.com/#@/resource${resourceId}`;
}
