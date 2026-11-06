import { defineConfig } from 'wxt';

// Fixed 2048-bit RSA public key to stabilize the extension ID for Notion OAuth redirect URL
const MANIFEST_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsnMNBRAOxpvxOn2NXlaoaSEgvtHJMvAyvFDmkGM367dSDDBU1P50o+QXHqOJ1VZTROmf2S88GQ1AAzFAviA+/w2XVBw8YNuKmEHvacCDnVWaK64YxUcn5veENmHZf1POfzANMqpNEXgkljRGxpvkwjz2n9/nJFE1MZ3BACxm7kBVCMiUXNAyF9pRqbLJ4ZyISWBQjEs2Bxv0+3rwGMz2i9lA7InWSYprw4DdOBYtuEyQT6DUBdwkqH1o4WOQGRm5K5p4YJMserYSkGJgbuZN9vjyB/4RAy8YQVfEveZh0wyzps+XSqYibsSnWsMNEJ7wZx+eTUiVFs4Ob+leUsTbyQIDAQAB';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    key: MANIFEST_KEY,
    name: 'LexiFlow AI',
    description: 'Contextual word translation & vocabulary collector with Notion sync',
    permissions: ['storage', 'alarms', 'identity', 'activeTab'],
    host_permissions: ['https://api.notion.com/*'],
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
    action: {
      default_title: 'LexiFlow AI',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
  },
});
