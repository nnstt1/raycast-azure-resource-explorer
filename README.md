# Azure Resource Explorer

A Raycast extension to search and explore Azure resources directly from your desktop.

## Features

- **Global Resource Search**: Search across all subscriptions without selecting one first
- **Subscription Filtering**: Browse resources within a specific subscription
- **Resource Type & Location Filters**: Narrow down results by resource type and Azure region
- **Favorites**: Save frequently accessed resources for quick access
- **History**: Automatically track recently accessed resources
- **Quick Actions**:
  - Open resource in Azure Portal
  - Copy resource ID
  - Copy resource name

## Prerequisites

- [Raycast](https://raycast.com/) installed on your Mac
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed and configured
- Logged in to Azure CLI (`az login`)

## Installation

### From Raycast Store

Search for "Azure Resource Explorer" in the Raycast Store and install.

### Manual Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Import to Raycast

## Usage

1. Open Raycast and search for "Search Azure Resources"
2. On the main screen, you'll see:
   - **Favorites**: Your saved resources
   - **Recently Accessed**: History of opened resources
   - **Subscriptions**: List of Azure subscriptions
3. Start typing to search across all subscriptions
4. Or select a subscription to browse its resources

## Configuration

Open the extension preferences in Raycast to configure:

| Preference | Description |
|------------|-------------|
| Azure CLI Path | Custom path to the Azure CLI executable (e.g., `/opt/homebrew/bin/az`). Leave empty to use default paths. |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Open in Azure Portal |
| `Cmd + C` | Copy Resource ID |
| `Cmd + Shift + C` | Copy Resource Name |
| `Cmd + S` | Add/Remove from Favorites |

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Fix lint issues
npm run fix-lint
```

## License

MIT
