/**
 * Electron Builder Configuration
 */

module.exports = {
  appId: 'com.oflayn-dokon.app',
  productName: 'Oflayn Dokon',
  copyright: 'Copyright © 2024 Oflayn Dokon',
  
  // Пропустить rebuild нативных модулей
  npmRebuild: false,
  
  directories: {
    output: 'release',
  },
  
  files: [
    'dist/**/*',
    'electron/**/*',
    'public/**/*',
    'node_modules/**/*',
    '!node_modules/.cache',
    '!node_modules/.pnpm',
    '!**/*.map',
    '!**/*.ts',
    '!**/tsconfig.json',
  ],
  
  extraResources: [
    {
      from: 'electron/config.json',
      to: 'config.json',
    },
  ],
  
  asar: true,
  asarUnpack: [
    'node_modules/**/*',
  ],
  
  win: {
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    icon: 'public/electon_icon.ico',
    artifactName: '${productName}-${version}-Setup.${ext}',
  },
  
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Oflayn Dokon',
  },
  
  mac: {
    target: ['dmg'],
    icon: 'public/electron_icon.png',
    category: 'public.app-category.business',
  },
  
  linux: {
    target: ['AppImage', 'deb'],
    icon: 'public/electron_icon.png',
    category: 'Office',
  },
};
