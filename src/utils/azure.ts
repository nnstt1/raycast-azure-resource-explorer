import { execSync } from "child_process";
import { AzureSubscription, AzureResource, AzureResourceRaw } from "../types";

const EXTRA_PATH = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
].join(":");

const ENV = {
  ...process.env,
  PATH: `${EXTRA_PATH}:${process.env.PATH || ""}`,
};

function execAzCommand(args: string[]): string {
  const command = `az ${args.join(" ")} --output json`;
  return execSync(command, {
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
    env: ENV,
  });
}

export function checkAzureCli(): { installed: boolean; loggedIn: boolean } {
  try {
    execSync("az --version", { encoding: "utf-8", stdio: "pipe", env: ENV });
  } catch {
    return { installed: false, loggedIn: false };
  }

  try {
    execSync("az account show", { encoding: "utf-8", stdio: "pipe", env: ENV });
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
  }));
}

export function getPortalUrl(resourceId: string): string {
  return `https://portal.azure.com/#@/resource${resourceId}`;
}
