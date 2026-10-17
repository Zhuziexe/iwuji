const BUILTIN_APPS = [
    { bundlename: 'com.wujios.phone', name: '电话', icon: './assets/phone.svg', src: 'apps/phone.js' },
    { bundlename: 'com.wujios.weather', name: '天气', icon: './assets/weather.svg', src: 'apps/weather.js' },
    { bundlename: 'com.wujios.camera', name: '相机', icon: './assets/camera.svg', src: 'apps/camera.js' },
    { bundlename: 'com.wujios.clock', name: '时钟', icon: './assets/clock.svg', src: 'apps/clock.js' },
    { bundlename: 'com.wujios.settings', name: '设置', icon: './assets/settings.svg', src: 'apps/settings.js' },
    { bundlename: 'com.wujios.photos', name: '图库', icon: './assets/photos.svg', src: 'apps/photos.js' },
    { bundlename: 'com.wujios.wujigallery', name: '应用市场', icon: './assets/wujigallery.svg', src: 'apps/wujigallery.js' },
    { bundlename: 'com.wujios.calculator', name: '计算器', icon: './assets/calculator.svg', src: 'apps/calculator.js' },
    { bundlename: 'com.wujios.themes', name: '主题', icon: './assets/themes.svg', src: 'apps/themes.js' },
];

const PRELOAD_SCRIPTS = [
    'store/apps.js',
];

window.BUILTIN_APPS = BUILTIN_APPS;
window.PRELOAD_SCRIPTS = PRELOAD_SCRIPTS;