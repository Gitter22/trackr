/** Base domain, injected at build time from the root env (APP_DOMAIN). */
export const APP_DOMAIN: string = import.meta.env.VITE_APP_DOMAIN || 'localhost';
