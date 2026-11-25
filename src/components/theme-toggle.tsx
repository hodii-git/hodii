/** Hodii is light-only. This clears any old saved dark preference so nobody is stuck in it. */
export const themeBootScript = `try{localStorage.removeItem("hodii-theme");document.documentElement.classList.remove("dark")}catch(e){}`;
