@description('Location for all resources')
param location string = resourceGroup().location

var uniqueSuffix = uniqueString(resourceGroup().id)
var acrName = 'acrworktimeprod${uniqueSuffix}'
var logAnalyticsName = 'log-worktime-prod'
var containerAppsEnvName = 'cae-worktime-prod'
var storageAccountName = 'stwtprod${uniqueSuffix}'
var postgresDataShareName = 'postgres-data'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// Postgres itself runs as a plain container app (see deploy.sh) rather than a managed
// Azure Database for PostgreSQL server - this share backs its data directory so it
// survives container restarts/redeploys instead of resetting every time (Container Apps
// are otherwise ephemeral).
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowSharedKeyAccess: true
  }
}

resource fileServices 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
}

resource postgresDataShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileServices
  name: postgresDataShareName
  properties: {
    shareQuota: 32
  }
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

resource postgresDataStorage 'Microsoft.App/managedEnvironments/storages@2023-05-01' = {
  parent: containerAppsEnv
  name: postgresDataShareName
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: postgresDataShareName
      accessMode: 'ReadWrite'
    }
  }
  dependsOn: [
    postgresDataShare
  ]
}

output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output containerAppsEnvName string = containerAppsEnv.name
output postgresDataStorageName string = postgresDataStorage.name
