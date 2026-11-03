const BUILTIN_APPS = [
    { bundlename: 'com.wujios.phone', name: '电话', src: 'apps/phone.js', platforms: ['wujios'] },
    { bundlename: 'com.wujios.weather', name: '天气', src: 'apps/weather.js' },
    { bundlename: 'com.wujios.camera', name: '相机', src: 'apps/camera.js' },
    { bundlename: 'com.wujios.clock', name: '时钟', src: 'apps/clock.js' },
    { bundlename: 'com.wujios.settings', name: '设置', src: 'apps/settings.js' },
    { bundlename: 'com.wujios.photos', name: '图库', src: 'apps/photos.js' },
    { bundlename: 'com.wujios.wujigallery', name: '应用市场', src: 'apps/wujigallery.js' },
    { bundlename: 'com.wujios.calculator', name: '计算器', src: 'apps/calculator.js' },
    { bundlename: 'com.wujios.themes', name: '主题', src: 'apps/themes.js' },
    { bundlename: 'com.wujios.taskmgr', name: '任务管理器', src: 'apps/taskmgr.js', platforms: ['zhuzios'] },
    { bundlename: 'com.wujios.files', name: '文件管理', src: 'apps/files.js' },
    { bundlename: 'com.wujios.filepreview', name: '文件预览', src: 'apps/filepreview.js', hidden: true }
];

const PRELOAD_SCRIPTS = [];

window.BUILTIN_APPS = BUILTIN_APPS;
window.PRELOAD_SCRIPTS = PRELOAD_SCRIPTS;