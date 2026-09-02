@description('Location for all resources')
param location string = resourceGroup().location

@description('Postgres Flexible Server admin username')
param postgresAdminUsername string = 'worktimeadmin'

@secure()
@description('Postgres Flexible Server admin password')
param postgresAdminPassword string

var uniqueSuffix = uniqueString(resourceGroup().id)
var acrName = 'acrworktimeprod${uniqueSuffix}'
var logAnalyticsName = 'log-worktime-prod'
var containerAppsEnvName = 'cae-worktime-prod'
var postgresServerName = 'psql-worktime-prod-${uniqueSuffix}'
var postgresDatabaseName = 'worktime'

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

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: postgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminUsername
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgres
  name: postgresDatabaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource postgresFirewallAllowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
output postgresFqdn string = postgres.properties.fullyQualifiedDomainName
output postgresServerName string = postgres.name
output postgresDatabaseName string = postgresDatabaseName
output containerAppsEnvName string = containerAppsEnv.name
