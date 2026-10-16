export const settingsKey = 'ottertap-site-settings-v1';

/** Runs before paint so a stored dark theme does not flash light. */
export const themeScript = `try{var t=(JSON.parse(localStorage.getItem(${JSON.stringify(settingsKey)})||'null')||{}).theme||'system';if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;
